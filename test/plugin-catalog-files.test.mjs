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
