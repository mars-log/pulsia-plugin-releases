import { createHash } from 'node:crypto'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import compatibility from './plugin-identity-compatibility.json' with { type: 'json' }
import { identity, packageAsset, numericOrder } from './catalog-history.mjs'

function metadata(release) {
  const match = release.body.match(/<!--\s*pulsia-plugin-metadata:(.*?)\s*-->/u)
  return match ? JSON.parse(match[1]) : {}
}

export async function splitCatalog(root, catalog) {
  const aliases = new Map(compatibility.map(row => [row.fromPluginId, row.toPluginId]))
  const products = new Map()
  const groups = new Map()
  const files = new Set()
  for (const release of catalog.releases) {
    const data = metadata(release)
    if (data.kind === 'pack' && data.id === identity(release.tag_name)?.id) {
      for (const row of data.pluginMigrations || []) {
        if (data.pluginPack?.some(member => member.pluginId === row.toPluginId) && !aliases.has(row.fromPluginId)) {
          aliases.set(row.fromPluginId, row.toPluginId)
        }
      }
    }
  }
  for (const channel of ['stable', 'prerelease']) await mkdir(join(root, 'details', channel), { recursive: true })
  for (const release of catalog.releases) {
    const product = identity(release.tag_name)
    const asset = packageAsset(release)
    if (!product || !asset) continue
    const channel = release.prerelease ? 'prerelease' : 'stable'
    const path = 'details/' + channel + '/' + product.id + '.json'
    files.add(path)
    const detail = JSON.stringify(release) + '\n'
    await writeFile(join(root, path), detail)
    release.detail_sha256 = createHash('sha256').update(detail).digest('hex')
    const data = metadata(release)
    delete data.manifest
    delete data.dependencyMap
    if (data.information) {
      const { schemaVersion, icon, publisher, categories, discovery, media } = data.information
      data.information = { schemaVersion, icon, publisher, categories, discovery, ...(media?.icon ? { media: { icon: media.icon } } : {}) }
    }
    release.body = release.body ? '<!-- pulsia-plugin-metadata:' + JSON.stringify(data).replaceAll('-->', '\\u002d\\u002d\\u003e') + ' -->' : ''
    release.detail_path = path

    let id = product.id
    const seen = new Set()
    while (aliases.has(id)) {
      if (seen.has(id)) throw Error('Cyclic plugin migration: ' + id)
      seen.add(id)
      id = aliases.get(id)
    }
    const channels = products.get(id) || {}
    const prior = channels[channel]
    if (!prior || numericOrder(product.version, prior.version) > 0 || product.version === prior.version && id === product.id) {
      if (channel === 'stable' || !groups.has(id)) groups.set(id, data.legacy ? 'legacy' : data.kind === 'pack' ? 'packs' : 'plugins')
      channels[channel] = { version: product.version, asset: asset.name, sha256: asset.digest.slice(7), ...(release.changelog_path ? { notesId: release.id } : {}), ...(product.id !== id ? { publishedId: product.id } : {}) }
    }
    products.set(id, channels)
  }
  for (const channel of ['stable', 'prerelease']) {
    const dir = join(root, 'details', channel)
    for (const file of await readdir(dir)) {
      if (file.endsWith('.json') && !files.has('details/' + channel + '/' + file)) await unlink(join(dir, file))
    }
  }
  const index = { format: 1, plugins: {}, packs: {}, legacy: {} }
  for (const [id, channels] of [...products].sort(([a], [b]) => a.localeCompare(b))) {
    index[groups.get(id)][id] = { ...channels.stable, ...(channels.prerelease ? { prerelease: channels.prerelease } : {}) }
  }
  await writeFile(join(root, 'pulsia-plugin-updates.json'), JSON.stringify(index) + '\n')
}
