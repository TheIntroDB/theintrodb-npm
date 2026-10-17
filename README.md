# TheIntroDB NPM Package

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Code Coverage][codecov-img]][codecov-url]

Typed TypeScript client package for the TheIntroDB API (v4).

Detailed documentation can be found at: https://theintrodb.github.io/theintrodb-npm/

## Install

```bash
npm install theintrodb
```

## Setting Up With An AI Coding Agent

If you are using an AI coding agent (Claude Code, opencode, Codex, Cursor,
Copilot, etc.), the package bundles version-matched agent docs. Paste the
following prompt and let the agent handle the setup:

> Install `theintrodb` in this project with `pnpm add theintrodb` (do not use
> `pnpm install theintrodb`). Then read `node_modules/theintrodb/AGENTS.md` and
> `node_modules/theintrodb/docs/getting-started.md` and set up a typed
> TheIntroDB client in this codebase according to those docs.

The bundled `AGENTS.md` and `docs/` folder always match the installed version,
so the agent never works from stale or generic knowledge. Types are declared in
`node_modules/theintrodb/lib/index.d.ts` and
`node_modules/theintrodb/lib/types.d.ts`.

## Features

- Centralized request, parsing, and validation logic
- Runtime validation of request payloads and API responses
- `GET /media` works without auth and can optionally use a current user API key
- `POST /submit` and `POST /map` require the current user's API key so requests act on that account
- TVDB-primary identity: address a media with `tvdbId` (preferred), `tmdbId` or `imdbId`
- Episode-order `mapping` support (`default`, `official`, `dvd`, `alternate`, `absolute`, `regional`, plus Jellyfin aliases)
- Normalized timestamp handling keeps `null` end times as "end of media" and converts `null` starts to `0`
- Reusable client or standalone function usage
- Optional logging hooks for auth-sensitive request flows
- Jest-based unit coverage for transport, parsing, and edge cases

## Example Usage

```ts
import { createIntroDbClient } from 'theintrodb';

const client = createIntroDbClient({
  // Optional: pass a logger if you want TIDB request/auth messages.
  // `console` is fine for quick debugging; omit this entirely if you do not want logs.
  logger: console,
});

// Public movie lookup: no API key required. TVDB is the identity.
const publicMedia = await client.getMedia({
  tvdbId: 169,
});

// Public TV lookup: include `season` and `episode` for a specific episode.
const publicEpisodeMedia = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
});

// `getMedia()` returns a discriminated union; narrow it with `kind`.
if (publicEpisodeMedia.kind === 'media') {
  console.log(publicEpisodeMedia.intro[0]?.startMs);
}

// Optional current-user API key:
// this can include that user's still-pending submissions in the response.
const mediaWithMyPendingSubmissions = await client.getMedia(
  {
    tvdbId: 169,
  },
  {
    apiKey: currentUserApiKey,
  }
);

// Submissions always require the current user's API key.
// The key should belong to the end user so the submission is attached to their account.
const submission = await client.submitMediaTimestamp(
  {
    tvdbId: 169,
    type: 'movie',
    segment: 'intro',
    startSec: 0,
    endSec: 90,
  },
  {
    apiKey: currentUserApiKey,
  }
);

// Preview where a submission would land before storing it.
const mapping = await client.mapSubmission(
  {
    tvdbId: 71663,
    type: 'tv',
    mapping: 'dvd',
    season: '1',
    episode: '1',
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Auth Model

- `getMedia()` does not require authentication
- `getMedia()` optionally accepts the current user's API key; when provided, the API may include that user's pending submissions in the weighted result
- `submitMediaTimestamp()` and `mapSubmission()` always require the current user's API key
- Do not ship a shared application API key; this package is designed for end-user keys

## API Notes

### Identity

- TVDB is the identity in v4: prefer `tvdbId`
- `tmdbId` and `imdbId` are accepted as alternate ways to address a media and are resolved server-side (slower)
- Provide at least one identity per request; the API resolves them in the priority order `tvdbId` -> `tmdbId` -> `imdbId`

### Get Media Timestamps

- Returns one of three shapes, discriminated by `kind`:
  - `'media'`: the grouped skip timestamps (`MediaRecord`)
  - `'versions'`: the release-version list, when `listVersions: true`
  - `'episodes'`: a per-episode submission-count fallback
- Use `tvdbId` for movies
- Use `tvdbId`, `season`, and `episode` for TV episodes
- `mapping` states the episode order your `season`/`episode` are given in; omitted means `default`
- `details: true` adds `confidence`/`submissionCount` per segment and `groupDurationMs` to the body
- Segment arrays are omitted by the API when no submissions exist for that segment type
- Segment arrays can contain multiple entries for the same segment type (for example, some episodes have multiple recaps); this is expected and should be handled by using all available segments

### Submit Timestamps

- Submit one segment at a time to `submitMediaTimestamp()`
- Use either `startSec`/`endSec` or `startMs`/`endMs`, never both
- `intro` and `recap` allow `null` starts
- `credits` and `preview` allow `null` ends, which mean "to the end of media"
- For TV, `season`/`episode` may be a single value or a list/range string (`'1,2'`, `'1-3'`, `'1,3-4,6'`)

## Timestamp Semantics

- `intro` and `recap`: `null` or `0` start values are normalized to `0`
- `credits` and `preview`: `null` end values remain `null`
- Normalized responses include `startsAtBeginning` and `endsAtMediaEnd` flags

## How The API Returns Times

TheIntroDB returns media timestamps from `GET /media` in arrays of objects shaped like:

```json
{
  "start_ms": 30000,
  "end_ms": 90000
}
```

Important details:

- The API returns response times in milliseconds, using the raw fields `start_ms` and `end_ms`
- Each segment type such as `intro`, `recap`, `credits`, and `preview` is returned as an array
- A segment array may contain multiple entries for the same segment type; this is not an error
- `start_ms: null` means the segment starts at the beginning of the media
- `end_ms: null` means the segment continues to the end of the media
- A segment array may be omitted entirely if no submissions exist for that segment type

This package normalizes those raw values into:

- `startMs`
- `endMs`
- `durationMs`
- `startsAtBeginning`
- `endsAtMediaEnd`

Example raw API response fragment:

```json
{
  "tvdb_id": 169,
  "type": "movie",
  "intro": [
    {
      "start_ms": null,
      "end_ms": 90000
    }
  ],
  "credits": [
    {
      "start_ms": 1800000,
      "end_ms": null
    }
  ]
}
```

Normalized package result:

```ts
{
  kind: 'media',
  tvdbId: 169,
  type: 'movie',
  groupDurationMs: null,
  intro: [
    {
      startMs: 0,
      endMs: 90000,
      durationMs: 90000,
      startsAtBeginning: true,
      endsAtMediaEnd: false,
    },
  ],
  credits: [
    {
      startMs: 1800000,
      endMs: null,
      durationMs: null,
      startsAtBeginning: false,
      endsAtMediaEnd: true,
    },
  ],
}
```

For submissions, the API accepts either:

- `startSec` and `endSec` in seconds with decimal precision
- `startMs` and `endMs` in integer milliseconds

The package converts second-based inputs into millisecond request values before sending them to TheIntroDB.

## Submission Example

```ts
await client.submitMediaTimestamp(
  {
    tvdbId: 71663,
    type: 'tv',
    season: 1,
    episode: 1,
    segment: 'credits',
    startSec: 5400,
    endSec: null,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Important

- User API keys are optional for reads and required for submissions and mapping
- When a user supplies their API key to `getMedia()`, they can see pending submissions tied to their own account
- This package validates payloads locally before making requests and validates JSON responses after receiving them

## Build

```bash
npm run build
npm test
```

[build-img]:https://github.com/theintrodb/theintrodb/actions/workflows/release.yml/badge.svg
[build-url]:https://github.com/theintrodb/theintrodb/actions/workflows/release.yml
[downloads-img]:https://img.shields.io/npm/dt/theintrodb
[downloads-url]:https://www.npmtrends.com/theintrodb
[npm-img]:https://img.shields.io/npm/v/theintrodb
[npm-url]:https://www.npmjs.com/package/theintrodb
[codecov-img]:https://codecov.io/gh/theintrodb/theintrodb/branch/main/graph/badge.svg
[codecov-url]:https://codecov.io/gh/theintrodb/theintrodb
