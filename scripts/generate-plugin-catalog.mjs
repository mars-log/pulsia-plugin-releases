import { readFile, writeFile } from 'node:fs/promises'
import { latestReleases, metadataBody, writeHistory } from './catalog-history.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { splitCatalog } from './plugin-catalog-files.mjs'
import { officialPatchReader } from './plugin-catalog-patches.mjs'

const PAGE_SIZE = 100
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const CATALOG_FILE = new URL('../pulsia-plugin-catalog.json', import.meta.url)

function selectedAsset(asset) {
  return {
    id: asset.id,
    name: asset.name,
    state: asset.state,
    size: asset.size,
    digest: asset.digest || null,
    browser_download_url: asset.browser_download_url,
    created_at: asset.created_at || null,
    updated_at: asset.updated_at || null
  }
}

export function selectedRelease(release, notesPath) {
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name || '',
    body: metadataBody(release.body),
    ...(notesPath ? { changelog_path: notesPath } : {}),
    draft: false,
    prerelease: release.prerelease === true,
    html_url: release.html_url,
    published_at: release.published_at || null,
    created_at: release.created_at || null,
    updated_at: release.updated_at || null,
    assets: Array.isArray(release.assets) ? release.assets.map(selectedAsset) : []
  }
}

function latestChange(releases) {
  let timestamps = []
  for (let release of releases) {
    timestamps.push(release.updated_at, release.published_at, release.created_at)
    for (let asset of release.assets) {
      timestamps.push(asset.updated_at, asset.created_at)
    }
  }
  let times = timestamps.map(function timestamp(value) { return Date.parse(value || '') }).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

export function createCatalog(repository, releases, links = new Map()) {
  let selected = latestReleases(releases).map(release => selectedRelease(release, links.get(release.id)))
  return {
    format: 'pulsia-plugin-catalog-v1',
    repository,
    latestOnly: true,
    generatedAt: latestChange(selected),
    releases: selected
  }
}

async function fetchReleasePage(repository, page, token) {
  let headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pulsia-plugin-catalog-generator',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  let response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=${PAGE_SIZE}&page=${page}`, {
    headers
  })
  if (!response.ok) {
    throw new Error(`GitHub Release 목록을 읽지 못함: HTTP ${response.status}`)
  }
  let releases = await response.json()
  if (!Array.isArray(releases)) {
    throw new Error('GitHub Release 응답이 배열이 아님')
  }
  return releases
}

async function fetchReleases(repository, token) {
  let releases = []
  for (let page = 1; ; page += 1) {
    let current = await fetchReleasePage(repository, page, token)
    releases.push(...current)
    if (current.length < PAGE_SIZE) {
      return releases
    }
  }
}

async function main() {
  let repository = String(process.env.GITHUB_REPOSITORY || 'mars-log/pulsia-plugin-releases').trim()
  let token = String(process.env.GITHUB_TOKEN || '').trim()
  let releases = await fetchReleases(repository, token)
  let baseline = []
  if (process.argv.includes('--migrate-existing')) {
    baseline = JSON.parse(await readFile(CATALOG_FILE, 'utf8')).releases
  }
  const links = await writeHistory(ROOT, repository, releases, baseline)
  let catalog = createCatalog(repository, releases, links)
  await splitCatalog(ROOT, catalog, officialPatchReader(repository, releases))
  await writeFile(CATALOG_FILE, `${JSON.stringify(catalog)}\n`, 'utf8')
  process.stdout.write(`${catalog.releases.length}개 Release의 정적 카탈로그를 생성함\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
