import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const extract = promisify(execFile)
const extractor = fileURLToPath(new URL('./zip-changelog.py', import.meta.url))

export function identity(tag) {
  const match = /^([a-z0-9][a-z0-9._-]*)(?:@|-v)(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)$/.exec(tag)
  return match ? { id: match[1], version: match[2] } : null
}

function historyId(release) {
  return identity(release.tag_name)?.id || '_other'
}

export function packageAsset(release) {
  const assets = (release.assets || []).filter(a => a.state === 'uploaded' && a.size > 0 && /^sha256:[a-f0-9]{64}$/i.test(a.digest) && /\.zip$/i.test(a.name))
  if (assets.length === 1) return assets[0]
  const named = assets.filter(a => /^pulsia-plugin-[a-z0-9_.-]+\.zip$/i.test(a.name))
  return named.length === 1 ? named[0] : undefined
}

export function numericOrder(a, b) {
  const [left, lpre] = a.split(/-(.*)/), [right, rpre] = b.split(/-(.*)/)
  const x = left.split('.').map(Number), y = right.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  if (!lpre || !rpre) return Number(!lpre) - Number(!rpre)
  const lp = lpre.split('.'), rp = rpre.split('.')
  for (let i = 0; i < Math.min(lp.length, rp.length); i++) {
    if (lp[i] === rp[i]) continue
    const ln = /^\d+$/.test(lp[i]), rn = /^\d+$/.test(rp[i])
    if (ln && rn) return Number(lp[i]) - Number(rp[i])
    if (ln !== rn) return ln ? -1 : 1
    return lp[i] < rp[i] ? -1 : 1
  }
  return lp.length - rp.length
}

export function latestReleases(releases) {
  const groups = new Map()
  for (const release of releases) {
    const product = identity(release.tag_name)
    if (release.draft) continue
    const key = product?.id || release.tag_name
    const group = groups.get(key) || []
    group.push(release)
    groups.set(key, group)
  }
  const latest = []
  for (const group of groups.values()) {
    const hasPackages = group.some(packageAsset)
    const candidates = group.filter(r => !hasPackages || packageAsset(r)).sort((a,b) =>
      numericOrder(identity(b.tag_name)?.version || '0.0.0', identity(a.tag_name)?.version || '0.0.0') || b.id - a.id)
    const stable = candidates.find(r => !r.prerelease)
    if (stable) latest.push(stable)
    if (candidates[0].prerelease) latest.push(candidates[0])
  }
  return latest
}

export function metadataBody(body) {
  const match = String(body || '').match(/<!--\s*pulsia-plugin-metadata:([^\r\n]{1,65536}?)\s*-->/u)
  if (!match) return ''
  try {
    const data = JSON.parse(match[1])
    delete data.changelog
    return '<!-- pulsia-plugin-metadata:' + JSON.stringify(data).replaceAll('-->', '\\u002d\\u002d\\u003e') + ' -->'
  } catch { return '' }
}

export async function writeHistory(root, repository, releases, baseline = []) {
  const dir = join(root, 'history'), notes = join(root, 'changelogs')
  await mkdir(dir, { recursive: true })
  const oldFiles = (await readdir(dir)).filter(name => name.endsWith('.json'))
  const previous = new Map()
  for (const file of oldFiles) {
    for (const row of JSON.parse(await readFile(join(dir, file), 'utf8')).releases) previous.set(row.releaseId, row)
  }
  const oldAssets = new Map(baseline.map(r => [r.id, packageAsset(r)?.digest]))
  const groups = new Map(), links = new Map()
  for (const release of releases.filter(r => !r.draft)) {
    const product = identity(release.tag_name), id = historyId(release), asset = packageAsset(release)
    const prior = previous.get(release.id)
    const row = { releaseId: release.id, tag: release.tag_name, version: product?.version || null, prerelease: release.prerelease === true,
      publishedAt: release.published_at, url: release.html_url, digest: asset?.digest || null }
    if (prior && prior.digest === row.digest && prior.notesChecked) {
      row.notesChecked = true
      if (prior.changelogPath) row.changelogPath = prior.changelogPath
    } else if (!asset || !product || (oldAssets.has(release.id) && oldAssets.get(release.id) === asset.digest)) {
      row.notesChecked = true
    } else {
      try {
        const { stdout } = await extract(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
          [extractor, repository, asset.browser_download_url, asset.digest, String(asset.size), product.version], {encoding:'utf8', maxBuffer: 600000, timeout: 120000})
        if (stdout.trim()) {
          const name = release.id + '-' + asset.digest.slice(7) + '.md'
          row.changelogPath = 'changelogs/' + name
          await mkdir(notes, { recursive: true })
          await writeFile(join(notes, name), stdout, 'utf8')
        }
        row.notesChecked = true
      } catch (error) {
        console.warn('변경 내역 재시도 대상', release.tag_name, error.message)
      }
    }
    if (row.changelogPath) links.set(release.id, row.changelogPath)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(row)
  }
  for (const [id, rows] of groups) {
    await writeFile(join(dir, id + '.json'), JSON.stringify({ pluginId: id, releases: rows.sort((a,b) => b.releaseId - a.releaseId) }) + '\n')
  }
  for (const file of oldFiles) if (!groups.has(file.slice(0,-5))) await unlink(join(dir,file))
  return links
}
