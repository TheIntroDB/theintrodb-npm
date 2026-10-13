## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

# Migrating v3 To v4

TheIntroDB API v4 is a breaking revision of the API surface. This package targets
v4 only, and its own types moved with it. This page lists what changed and how to
update call sites.

## 1. Base URL

The default base URL is now `https://api.theintrodb.org/v4`. If you pinned
`baseUrl` explicitly, update it. The frozen `/v2` and `/v3` endpoints still exist
server-side but carry a single endpoint each (`GET /media`) and are no longer
extended.

## 2. TVDB is the identity

v4 keys every response by `tvdb_id`. TMDB is no longer the primary identity, and
`tmdb_id` is deliberately absent from responses (a media with no TMDB
counterpart is a normal media rather than a fake `tmdb_id: 0`).

- `getMedia({ tmdbId })` still works, but prefer `getMedia({ tvdbId })`.
- `MediaRecord.tmdbId` is gone; read `MediaRecord.tvdbId`.
- `SubmissionData.tmdbId` is gone; read `SubmissionData.tvdbId` (nullable).
- For submissions, provide any one of `tvdbId`, `tmdbId` or `imdbId`. `tvdbId`
  is preferred; the others are resolved server-side and are slower.

```ts
// before
await client.getMedia({ tmdbId: 12345 });

// after
await client.getMedia({ tvdbId: 169 });
```

## 3. `getMedia()` returns a discriminated union

`GET /media` answers with one of three bodies. `getMedia()` now returns the
matching normalized shape and every shape carries a `kind` discriminator:

- `kind: 'media'` (`MediaRecord`): the grouped skip timestamps (the default)
- `kind: 'versions'` (`MediaVersions`): when you pass `listVersions: true`
- `kind: 'episodes'` (`MediaEpisodeList`): a per-episode submission-count
  fallback

Narrow before reading segment arrays:

```ts
const result = await client.getMedia({ tvdbId: 169 });

if (result.kind === 'media') {
  console.log(result.intro);
}
```

`parseMediaResponse()` picks the right parser automatically. The individual
parsers (`parseMediaRecord`, `parseMediaVersions`, `parseMediaEpisodes`) are
exported for callers that already know which shape they expect.

## 4. New `getMedia()` parameters

| Parameter | Purpose |
| --- | --- |
| `mapping` | The episode order your `season`/`episode` numbers are given in |
| `tvdbEpisodeId` | Pins one exact TVDB episode record |
| `episodeName` / `episodeTitle` | Optional title hint corroborating the resolved episode |
| `listVersions` | Return the release-version list instead of skip timestamps |
| `mergeUnknown` | Whether no-known-duration submissions join the release group |
| `details` | Add `confidence`/`submissionCount` per segment and `groupDurationMs` |

`mergeUnknown` is left to the API default (`true`) unless you set it.
`GetMediaParams` also moved to `tvdbId` first, and `season`/`episode` now accept
`0` (specials).

## 5. Episode orders (`mapping`)

This is the headline v4 feature for clients whose numbering comes from a media
server. Every submission is stored in TVDB's `default` order. When your
`season`/`episode` are expressed in another order, pass `mapping` and the API
converts them into `default` before storing, echoing your own coordinates back in
the `/media` response.

Canonical orders:

- `default`
- `official`
- `dvd`
- `alternate`
- `absolute`
- `regional`

Aliases are accepted and canonicalised, matching TVDB's own names and the
Jellyfin `displayorder` vocabulary:

| Spelling | Canonical |
| --- | --- |
| `officialorder`, `aired`, `airedorder` | `official` |
| `altdvd`, `dvdorder` | `dvd` |
| `absoluteorder`, `abso` | `absolute` |
| `alternateorder`, `alttwo`, `streaming`, `streamingorder` | `alternate` |
| `regionalorder`, `production`, `productionorder` | `regional` |
| `defaultorder` | `default` |

Case, spaces, dashes and underscores are ignored. An unknown spelling is
rejected locally (and by the API with a `400`), and an order TVDB does not carry
for a series is a `400` from the API.

```ts
await client.getMedia({ tvdbId: 71663, mapping: 'dvd', season: 1, episode: 1 });
await client.submitMediaTimestamp(
  { tvdbId: 71663, type: 'tv', mapping: 'alttwo', season: '1', episode: '1', segment: 'intro', startSec: 0, endSec: 90 },
  { apiKey }
);
```

`normalizeEpisodeOrder()` is exported if you want to canonicalise a spelling
yourself, and `EPISODE_ORDERS` / `EPISODE_ORDER_ALIASES` expose the tables.

## 6. Submission changes

- `ok` is now part of the `/submit` response: `{ ok: true, submissions: [...] }`.
- Identity is `tvdbId`, `tmdbId` or `imdbId` (any one, `tvdbId` preferred).
- New optional fields: `mapping`, `tvdbEpisodeId`, `episodeName` /
  `episodeTitle`.
- TV `season`/`episode` accept a list or an ascending range as a string
  (`'1,2'`, `'1-3'`, `'1,3-4,6'`), and `0` is a valid number.
- `videoDurationMs` is only allowed for a single TV episode (not a list or
  range). A string that is a single value (for example `'1'`) is allowed.
- Movies must omit `season`, `episode`, `mapping` and `tvdbEpisodeId`.

## 7. New endpoint: `POST /map`

`mapSubmission()` is a dry run of `/submit`. It resolves exactly as a submission
would and returns the resolved coordinates without storing anything, so a plugin
can show the user where a submission will land before they send it.

```ts
const resolved = await client.mapSubmission(
  { tvdbId: 71663, type: 'tv', mapping: 'dvd', season: '1', episode: '1' },
  { apiKey }
);

console.log(resolved.season, resolved.episode, resolved.tvdbEpisodeId);
```

It requires the current user's API key, and it refuses a list or range of
seasons/episodes with `400` because those cannot be reported as a single
mapping.

## 8. Rate and usage limit metadata

`TheIntroDbApiError.rateLimit` gained the specific-media usage cap headers:

- `specificMediaLimit`
- `specificMediaRemaining`
- `specificMediaResetSeconds`

These accompany `code: "specific_media_usage_limit_exceeded"` when a caller
repeatedly requests the same media target past the per-caller cap.

## Quick checklist

- [ ] Change any pinned `baseUrl` to `/v4`
- [ ] Replace `tmdbId` reads with `tvdbId` on media and submission results
- [ ] Narrow `getMedia()` results on `kind`
- [ ] Pass `mapping` when your `season`/`episode` come from a non-default order
- [ ] Read `ok` from the `/submit` response if you previously ignored it
- [ ] Use `mapSubmission()` to preview TMDB- or IMDb-addressed submissions
