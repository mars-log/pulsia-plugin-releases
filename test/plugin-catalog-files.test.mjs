import { officialPatchReader } from '../scripts/plugin-catalog-patches.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { splitCatalog } from '../scripts/plugin-catalog-files.mjs'

test('업데이트 ID를 한 번만 싣고 이전 ID와 상세 파일을 구분함', async t => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-split-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const release = (id, version, kind) => ({ tag_name: id + '@' + version,
    body: '<!-- pulsia-plugin-metadata:' + JSON.stringify({ id, version, kind,
      information: { schemaVersion: 1, features: [{ id: 'docs', markdown: 'long text' }] }, manifest: { id, version } }) + ' -->',
    assets: [{ name: 'plugin.zip', size: 99, state: 'uploaded', digest: 'sha256:' + 'b'.repeat(64) }] })
  const catalog = { releases: [release('wintera.net-manager','1.0.101','frontend'), release('pulsia.net-manager','1.0.102','frontend'), release('test.pack','1.0.101','pack')] }
  await splitCatalog(root, catalog)
  const index = JSON.parse(await readFile(join(root, 'pulsia-plugin-updates.json')))
  assert.deepEqual(Object.keys(index.plugins), ['pulsia.net-manager'])
  assert.equal(index.plugins['pulsia.net-manager'].version, '1.0.102')
  assert.ok(index.packs['test.pack'])
  assert.doesNotMatch(JSON.stringify([catalog,index]), /long text|"manifest":/)
  const row = catalog.releases[1]
  const bytes = await readFile(join(root, row.detail_path))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.detail_sha256)
  assert.match(bytes.toString(), /long text/)
})

test('공식 같은 버전 패치만 공개하고 교체·철회와 채널을 구분함', async t => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-patch-split-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const repository = 'mars-log/pulsia-plugin-releases'
  const id = 'test.plugin', version = '1.0.101'
  const assetName = 'stable.json'
  const url = 'https://github.com/' + repository + '/releases/download/patches-stable/' + assetName
  const metadata = { id, version, manifest: { id, version, updates: { provider:'github-releases', repository, patches: { enabled:true, manifest:url } } } }
  const release = prerelease => ({ tag_name: id + '@' + version, prerelease,
    body: '<!-- pulsia-plugin-metadata:' + JSON.stringify(metadata) + ' -->',
    assets: [{ name:'plugin.zip', size:99, state:'uploaded', digest:'sha256:' + 'b'.repeat(64) }] })
  const build = async ({ sequence, draft = false, baseVersion = version, status = 200, assetDigest } = {}) => {
    const asset = JSON.stringify({ schemaVersion:1, pluginId:id, baseVersion, patchId:'p' + sequence, sequence, files:[{ path:'frontend/main.js', size:9, sha256:'c'.repeat(64), url:'https://github.com/' + repository + '/releases/download/p' + sequence + '/main.js' }] })
    const sha256 = createHash('sha256').update(asset).digest('hex')
    let requests = []
    const read = officialPatchReader(repository, [{ draft, prerelease:false, tag_name:'patches-stable',
      assets: [{ name:assetName, state:'uploaded', digest:'sha256:' + (assetDigest || sha256) }] }], async address => {
      requests.push(address.href)
      return new Response(asset,{ status })
    })
    await splitCatalog(root, { releases:[release(false),release(true)] }, read)
    return { row: JSON.parse(await readFile(join(root,'pulsia-plugin-updates.json'))).plugins[id], requests, sha256 }
  }
  const first = await build({ sequence:1 })
  assert.deepEqual(first.row.patch, { pluginId:id, baseVersion:version, patchId:'p1', sequence:1, sha256:first.sha256 })
  assert.equal(first.row.prerelease.patch, undefined)
  assert.deepEqual(first.requests, [url])
  assert.equal((await build({ sequence:2 })).row.patch.sequence, 2)
  assert.equal((await build({ sequence:2, baseVersion:'1.0.102' })).row.patch, undefined)
  assert.equal((await build({ sequence:2, status:404 })).row.patch, undefined)
  assert.deepEqual((await build({ sequence:2, draft:true })).requests, [])
  await assert.rejects(build({ sequence:2, assetDigest:'a'.repeat(64) }), /hash mismatch/)
  await assert.rejects(build({ sequence:2, status:503 }), /HTTP 503/)
})
