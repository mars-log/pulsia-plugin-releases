import { createHash } from 'node:crypto'

const limit = 256 * 1024
const digest = /^[a-f0-9]{64}$/u
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u

function sourceUrl(value, repository) {
  const url = new URL(value)
  const parts = url.pathname.split('/').slice(1)
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash
    || parts.slice(0, 2).join('/').toLowerCase() !== repository
    || /%(?:2f|5c|2e)|\\/iu.test(value)) throw Error('Invalid official patch source: ' + value)
  if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4
    && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(parts[2])) return { url }
  if (url.hostname === 'github.com' && parts[2] === 'releases' && parts.length === 6) {
    if (parts[3] === 'download') return { url, tag: decodeURIComponent(parts[4]), asset: decodeURIComponent(parts[5]) }
    if (parts[3] === 'latest' && parts[4] === 'download') return { url, latest: true, asset: decodeURIComponent(parts[5]) }
  }
  throw Error('Invalid official patch source: ' + value)
}

function validateFiles(files, repository) {
  const paths = new Set()
  let size = 0
  for (const file of files) {
    const path = file?.path
    if (typeof path !== 'string' || !/^(?:frontend|assets|styles|screenshots)\//u.test(path)
      || path.split('/').some(part => !part || part === '.' || part === '..')
      || paths.has(path.toLowerCase()) || !digest.test(file.sha256 || '')
      || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 8 * 1024 * 1024) {
      throw Error('Invalid official patch file')
    }
    const source = sourceUrl(file.url, repository)
    if (!source.tag && !(source.url.hostname === 'raw.githubusercontent.com' && /^\/[^/]+\/[^/]+\/[a-f0-9]{40}\//iu.test(source.url.pathname))) {
      throw Error('Official patch files must be immutable')
    }
    paths.add(path.toLowerCase())
    size += file.size
  }
  if (size > 32 * 1024 * 1024) throw Error('Official patch files exceed total size limit')
}

export function officialPatchReader(repository, releases, fetch = globalThis.fetch) {
  repository = repository.toLowerCase()
  const requests = new Map()
  async function read(source, prerelease) {
    let selected
    if (source.latest && prerelease) return null
    if (source.tag) {
      const parent = releases.find(release => release.draft === false && release.tag_name === source.tag && Boolean(release.prerelease) === prerelease)
      selected = parent?.assets?.find(asset => asset.name === source.asset && asset.state === 'uploaded')
      if (!selected) return null
    }
    const response = await fetch(source.url, { signal: AbortSignal.timeout(15000) })
    if (response.status === 404 || response.status === 410) return null
    if (!response.ok) throw Error('Could not read official patch manifest: HTTP ' + response.status)
    const chunks = []
    let length = 0
    for await (const chunk of response.body) {
      length += chunk.length
      if (length > limit) throw Error('Official patch manifest exceeds size limit')
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (selected?.digest && selected.digest !== 'sha256:' + sha256) throw Error('Official patch asset hash mismatch')
    return { data: JSON.parse(bytes.toString('utf8')), sha256 }
  }
  return async function publishedPatch(updates, product, prerelease) {
    if (updates?.provider !== 'github-releases' || updates.repository?.toLowerCase() !== repository || updates.patches?.enabled !== true) return null
    const source = sourceUrl(updates.patches.manifest, repository)
    const key = source.url.href + ':' + prerelease
    if (!requests.has(key)) requests.set(key, read(source, prerelease))
    const found = await requests.get(key)
    if (!found) return null
    const { data, sha256 } = found
    if (data.pluginId !== product.id || data.baseVersion !== product.version) return null
    if (data.schemaVersion !== 1 || !identifier.test(data.patchId || '') || !Number.isSafeInteger(data.sequence) || data.sequence < 1
      || !Array.isArray(data.files) || data.files.length === 0 || data.files.length > 256) throw Error('Invalid official patch manifest: ' + source.url)
    validateFiles(data.files, repository)
    return { pluginId: data.pluginId, baseVersion: data.baseVersion, patchId: data.patchId, sequence: data.sequence, sha256 }
  }
}
