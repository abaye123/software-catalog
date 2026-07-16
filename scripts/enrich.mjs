// scripts/enrich.mjs
//
// Reads catalog.json (hand-maintained) and writes catalog.generated.json with
// live GitHub data folded in: stars, lifetime downloads, and the latest
// release's assets.
//
// Why this runs here and not in the browser: unauthenticated GitHub API callers
// get 60 requests/hour per IP. The site needs ~1 request per repo, so a visitor
// behind a shared/CGNAT address (most mobile networks) can exhaust that for
// everyone sharing it. Here we run once, with GITHUB_TOKEN's 5,000/hour, and the
// site fetches the single generated file from raw.githubusercontent.com — a CDN
// that isn't rate limited at all.
//
// The generated file carries the full asset list rather than a single download
// URL, so the site can still pick the right binary for the visitor's OS without
// making an API call of its own.

import { readFile, writeFile } from 'node:fs/promises'

const OWNER = 'abaye123'
const API = 'https://api.github.com'
const TOKEN = process.env.GITHUB_TOKEN

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

const api = async (path) => {
  const res = await fetch(`${API}${path}`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${await res.text()}`)
  return res.json()
}

/** Stars for one repo. Null when the repo is missing or private. */
const fetchRepo = async (repo) => {
  const data = await api(`/repos/${OWNER}/${repo}`)
  return data ? { stars: data.stargazers_count, updatedAt: data.pushed_at } : null
}

/**
 * Latest published release plus lifetime download totals. Counts downloads
 * across every release, not just the newest, so the number reflects the
 * software's real reach rather than resetting on each version.
 */
const fetchRelease = async (repo) => {
  const releases = await api(`/repos/${OWNER}/${repo}/releases?per_page=100`)
  if (!Array.isArray(releases) || releases.length === 0) return null

  const published = releases.filter((r) => !r.draft)
  if (published.length === 0) return null

  const latest = published.find((r) => !r.prerelease) || published[0]
  const downloads = published.reduce(
    (sum, r) => sum + (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
    0,
  )

  return {
    tag: latest.tag_name,
    url: latest.html_url,
    publishedAt: latest.published_at,
    downloads,
    assets: (latest.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
      downloads: a.download_count,
    })),
  }
}

const enrich = async (item, previousById) => {
  // Entries without a repo are perfectly valid — a paid product need not be
  // open source. They simply carry no live stats.
  if (!item.repo) return { ...item }

  try {
    const [repo, release] = await Promise.all([fetchRepo(item.repo), fetchRelease(item.repo)])
    return {
      ...item,
      stars: repo?.stars ?? null,
      downloads: release?.downloads ?? null,
      release: release
        ? { tag: release.tag, url: release.url, publishedAt: release.publishedAt, assets: release.assets }
        : null,
    }
  } catch (err) {
    // A rate limit or a blip must never blank out numbers that were already
    // correct: carry the previous run's stats forward rather than writing null,
    // which would erase them from the site until the next successful run.
    // One bad repo also must not fail the whole catalog.
    const prev = previousById.get(item.id)
    console.error(`! ${item.repo}: ${err.message.split('\n')[0]}`)
    console.error(`  -> keeping previous stats${prev?.stars == null ? ' (none on record)' : ''}`)
    return {
      ...item,
      stars: prev?.stars ?? null,
      downloads: prev?.downloads ?? null,
      release: prev?.release ?? null,
      staleSince: prev ? prev.staleSince || new Date().toISOString() : undefined,
    }
  }
}

const main = async () => {
  if (!TOKEN) console.warn('! No GITHUB_TOKEN — falling back to 60 req/hour. Fine locally, not in CI.')

  const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'))
  if (!Array.isArray(catalog.software)) throw new Error('catalog.json: "software" must be an array')

  const ids = catalog.software.map((s) => s.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicates.length) throw new Error(`catalog.json: duplicate id(s): ${[...new Set(duplicates)].join(', ')}`)
  if (ids.some((id) => !id)) throw new Error('catalog.json: every entry needs an "id"')

  const path = new URL('../catalog.generated.json', import.meta.url)
  let previous = null
  try {
    previous = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    /* first run */
  }
  const previousById = new Map((previous?.software || []).map((s) => [s.id, s]))

  const software = await Promise.all(catalog.software.map((item) => enrich(item, previousById)))

  for (const s of software) {
    const bits = [s.stars != null && `${s.stars}*`, s.downloads != null && `${s.downloads} dl`, s.release?.tag]
    console.log(`  ${s.id.padEnd(14)} ${bits.filter(Boolean).join('  ') || '(no repo data)'}`)
  }

  const out = {
    generatedAt: new Date().toISOString(),
    software,
  }

  // Compare ignoring generatedAt, so a scheduled run with no real change leaves
  // the file — and the git history — untouched.
  if (previous && JSON.stringify(previous.software) === JSON.stringify(out.software)) {
    console.log('\nNo changes.')
    return
  }

  await writeFile(path, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log('\nWrote catalog.generated.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
