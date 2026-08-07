# AGENTS.md

This file is for AI coding agents working in a project that has installed
`theintrodb`. It explains how to set the package up and use it correctly.

## What This Is

`theintrodb` is a typed TypeScript client for the TheIntroDB API. It retrieves
and submits intro, recap, credits, and preview timestamps for movies and TV
episodes. It requires Node >= 18.

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

- `baseUrl`: Override the API base URL. Defaults to `https://api.theintrodb.org/v3`.
- `apiKey`: Optional current-user API key for a client that always acts as one user.
- `headers`: Additional headers merged into every request.
- `fetch`: Custom fetch implementation for Node, tests, or other runtimes.
- `logger`: Optional logger (`console` works for debugging).

## Read Media Timestamps

`getMedia()` is public and does not require an API key.

```ts
// Movie
const movie = await client.getMedia({ tmdbId: 12345 });

// TV episode
const episode = await client.getMedia({ tmdbId: 67890, season: 1, episode: 1 });
```

Optional `GetMediaParams` fields: `tmdbId` (preferred), `imdbId`, `tvdbId`,
`season`, `episode`, `durationMs`.

Passing the current user's API key makes the response include that user's
still-pending submissions:

```ts
const media = await client.getMedia({ tmdbId: 12345 }, { apiKey });
```

## Submit Timestamps

`submitMediaTimestamp()` always requires the current user's API key so the
submission is credited to that user's account.

```ts
await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    startSec: 0,
    endSec: 90,
  },
  { apiKey }
);
```

### Required submission fields

- `tmdbId`: number
- `type`: `'movie'` | `'tv'`
- `segment`: `'intro'` | `'recap'` | `'credits'` | `'preview'`
- One time format only — either `startSec`/`endSec` (seconds, decimal
  precision) or `startMs`/`endMs` (integer milliseconds). Never both.

### Optional submission fields

- `imdbId`, `season`, `episode` (TV only), `videoDurationMs`

### Time rules

- `intro` and `recap` allow `null` starts, which mean "starts at the beginning".
- `credits` and `preview` allow `null` ends, which mean "to the end of media".
- Submit one segment per call.

## Auth Model

- `getMedia()` works without auth.
- `getMedia()` optionally accepts the current user's API key to include that
  user's pending submissions in the weighted result.
- `submitMediaTimestamp()` requires the current user's API key.
- Do not ship a shared application key. Keys belong to the end user.

## Response Shape

`getMedia()` returns a `MediaRecord` with normalized arrays for `intro`,
`recap`, `credits`, and `preview`. Each entry is a `NormalizedSegmentTimestamp`:

- `startMs`: `null` source starts are normalized to `0`
- `endMs`: `null` stays `null` and means the segment runs to media end
- `durationMs`: `null` when either endpoint is unknown
- `startsAtBeginning`, `endsAtMediaEnd`: source-shape flags
- `confidence`, `submissionCount`: optional metadata

Segment arrays may contain multiple entries for the same segment type and may
be omitted entirely when no submissions exist for that type.

## Errors

Catch `TheIntroDbValidationError` for invalid input, and
`TheIntroDbApiError` for failed requests. Use `TheIntroDbResponseValidationError`
to distinguish malformed API responses.

## Where To Find Full Docs

Read the bundled, version-matched docs at `node_modules/theintrodb/docs/`
(start with `getting-started.md`), or the published docs at
https://theintrodb.github.io/theintrodb-npm/.

Verify types against `node_modules/theintrodb/lib/index.d.ts` and
`node_modules/theintrodb/lib/types.d.ts` when writing code against this
package instead of relying on memory.
