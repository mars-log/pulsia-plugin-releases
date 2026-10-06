import assert from 'node:assert/strict'
import test from 'node:test'

import { createCatalog } from '../scripts/generate-plugin-catalog.mjs'

test('정적 카탈로그는 초안을 제외하고 Release 설치 정보와 마지막 변경 시각을 보존함', function run() {
  let catalog = createCatalog('mars-log/pulsia-plugin-releases', [
    {
      id: 1,
      tag_name: 'sample.plugin@1.0.0',
      name: 'Sample Plugin 1.0.0',
      body: '설명',
      draft: false,
      prerelease: false,
      html_url: 'https://github.com/mars-log/pulsia-plugin-releases/releases/tag/sample.plugin%401.0.0',
      published_at: '2026-10-05T00:00:00Z',
      created_at: '2026-10-04T00:00:00Z',
      updated_at: '2026-10-05T01:00:00Z',
      assets: [{
        id: 2,
        name: 'sample-plugin.zip',
        state: 'uploaded',
        size: 128,
        digest: `sha256:${'a'.repeat(64)}`,
        browser_download_url: 'https://github.com/mars-log/pulsia-plugin-releases/releases/download/sample.plugin%401.0.0/sample-plugin.zip',
        created_at: '2026-10-05T00:30:00Z',
        updated_at: '2026-10-05T02:00:00Z'
      }]
    },
    { id: 3, tag_name: 'draft@1.0.0', draft: true, assets: [] }
  ])

  assert.equal(catalog.format, 'pulsia-plugin-catalog-v1')
  assert.equal(catalog.repository, 'mars-log/pulsia-plugin-releases')
  assert.equal(catalog.generatedAt, '2026-10-05T02:00:00.000Z')
  assert.equal(catalog.releases.length, 1)
  assert.equal(catalog.releases[0].assets[0].size, 128)
})
