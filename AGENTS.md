# AGENTS.md

This file is for AI coding agents working in a project that has installed
`theintrodb`. It explains how to set the package up and use it correctly.

## What This Is

`theintrodb` is a typed TypeScript client for the TheIntroDB API (v4). It
retrieves and submits intro, recap, credits, and preview timestamps for movies
and TV episodes. It requires Node >= 18.

## Install

Use your project's package manager to add the dependency:

```bash
pnpm add theintrodb
```

Do not run `pnpm install theintrodb`; `pnpm install` does not accept package
names. Use `pnpm add`.

## Create A Client

```ts
import { createIntroDbClient } from 'theintrodb';

const client = createIntroDbClient({
  // Optional. Pass `console` for request/auth logging, or omit to disable.
  logger: console,
});
```

Client options:

- `baseUrl`: Override the API base URL. Defaults to `https://api.theintrodb.org/v4`.
- `apiKey`: Optional current-user API key for a client that always acts as one user.
- `headers`: Additional headers merged into every request.
- `fetch`: Custom fetch implementation for Node, tests, or other runtimes.
- `logger`: Optional logger (`console` works for debugging).

## Identity

TVDB is the identity in v4. Address a media with at least one of `tvdbId`,
`tmdbId` or `imdbId`, and prefer `tvdbId`: the other two are resolved
server-side and are slower. When more than one is supplied the API applies the
priority order `tvdbId` -> `tmdbId` -> `imdbId`.

```ts
const media = await client.getMedia({ tvdbId: 71663, season: 1, episode: 1 });
```

## Read Media Timestamps

`getMedia()` is public and does not require an API key. It returns one of three
shapes, discriminated by `kind`:

- `kind: 'media'`: the grouped skip timestamps (`MediaRecord`)
- `kind: 'versions'`: the release-version list, when `listVersions: true`
- `kind: 'episodes'`: a per-episode submission-count fallback

```ts
const result = await client.getMedia({ tvdbId: 169 });

if (result.kind === 'media') {
  console.log(result.intro[0]?.startMs);
}
```

Optional `GetMediaParams` fields: `tvdbId`, `tmdbId`, `imdbId`, `season`,
`episode`, `mapping`, `tvdbEpisodeId`, `episodeName`, `episodeTitle`,
`durationMs`, `listVersions`, `mergeUnknown`, `details`.

`mapping` names the episode order your `season`/`episode` are given in:

- `'default'`, `'official'`, `'dvd'`, `'alternate'`, `'absolute'`, `'regional'`
- aliases are accepted and canonicalised (`'aired'` becomes official, `'altdvd'`
  becomes dvd, `'alttwo'` and `'streaming'` become alternate, `'production'`
  becomes regional); omitted means `default`

`details: true` adds `confidence`/`submissionCount` to each returned segment and
`groupDurationMs` to the body.

Passing the current user's API key makes the response include that user's
still-pending submissions:

```ts
const media = await client.getMedia({ tvdbId: 169 }, { apiKey });
```

## Submit Timestamps

`submitMediaTimestamp()` always requires the current user's API key so the
submission is credited to that user's account.

```ts
await client.submitMediaTimestamp(
  {
    tvdbId: 169,
    type: 'movie',
    segment: 'intro',
    startSec: 0,
    endSec: 90,
  },
  { apiKey }
);
```

### Required submission fields

- an identity: any one of `tvdbId`, `tmdbId`, `imdbId`
- `type`: `'movie'` | `'tv'`
- `segment`: `'intro'` | `'recap'` | `'credits'` | `'preview'`
- One time format only: either `startSec`/`endSec` (seconds, decimal precision)
  or `startMs`/`endMs` (integer milliseconds). Never both.

### Optional submission fields

- `season`, `episode` (TV only; a single value, or a list/range string such as
  `'1,2'`, `'1-3'`, `'1,3-4,6'`)
- `mapping`, `tvdbEpisodeId`, `episodeName` / `episodeTitle`, `videoDurationMs`

### Time rules

- `intro` and `recap` allow `null` starts, which mean "starts at the beginning".
- `credits` and `preview` allow `null` ends, which mean "to the end of media".
- Submit one segment per call.

### Preview a submission with `mapSubmission()`

`mapSubmission()` is a dry run of `/submit`: it resolves the same way and returns
what the request **would** map to, storing nothing. It also requires the current
user's API key.

```ts
const resolved = await client.mapSubmission(
  { tvdbId: 71663, type: 'tv', mapping: 'dvd', season: '1', episode: '1' },
  { apiKey }
);

console.log(resolved.season, resolved.episode, resolved.episodeTitle);
```

## Auth Model

- `getMedia()` works without auth.
- `getMedia()` optionally accepts the current user's API key to include that
  user's pending submissions in the weighted result.
- `submitMediaTimestamp()` and `mapSubmission()` require the current user's API key.
- Do not ship a shared application key. Keys belong to the end user.

## Response Shape

`getMedia()` with `kind: 'media'` returns a `MediaRecord` with normalized arrays
for `intro`, `recap`, `credits`, and `preview`. Each entry is a
`NormalizedSegmentTimestamp`:

- `startMs`: `null` source starts are normalized to `0`
- `endMs`: `null` stays `null` and means the segment runs to media end
- `durationMs`: `null` when either endpoint is unknown
- `startsAtBeginning`, `endsAtMediaEnd`: source-shape flags
- `confidence`, `submissionCount`: present only when `details: true` was requested

The `MediaRecord` also carries `tvdbId`, `type`, optional `season`/`episode`, and
`groupDurationMs` (only when `details: true`).

Segment arrays may contain multiple entries for the same segment type and may be
omitted entirely when no submissions exist for that type.

## Errors

Catch `TheIntroDbValidationError` for invalid input, and `TheIntroDbApiError` for
failed requests. Use `TheIntroDbResponseValidationError` to distinguish malformed
API responses. `TheIntroDbApiError.rateLimit` carries `X-RateLimit-*`,
`X-UsageLimit-*` and `X-UsageLimit-SpecificMedia-*` metadata.

## Where To Find Full Docs

Read the bundled, version-matched docs at `node_modules/theintrodb/docs/` (start
with `getting-started.md`; `migration-v3-to-v4.md` lists what changed since the
v3 client), or the published docs at
https://theintrodb.github.io/theintrodb-npm/.

Verify types against `node_modules/theintrodb/lib/index.d.ts` and
`node_modules/theintrodb/lib/types.d.ts` when writing code against this package
instead of relying on memory.
