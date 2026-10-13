## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

# Getting Started

## Install

```bash
npm install theintrodb
```

## Import

```ts
import {
  createIntroDbClient,
  getMedia,
  mapSubmission,
  submitMediaTimestamp,
  type TIDBClient,
  type TIDBClientOptions,
} from 'theintrodb';
```

## Create A Client

```ts
const client = createIntroDbClient({
  logger: console,
});
```

### Client Options

- `baseUrl`: Override the API base URL. Defaults to `https://api.theintrodb.org/v4`.
- `apiKey`: Optional current-user API key. Useful if you want a client instance that always acts on behalf of one user.
- `headers`: Additional headers merged into each request.
- `fetch`: Custom fetch implementation for tests, Node runtimes, or other environments.
- `logger`: Optional TIDB logger. Pass `console` for simple logging, or omit it to disable logs.

## Identity

TVDB is the identity in v4. Address a media with exactly one of `tvdbId`, `tmdbId` or `imdbId`, preferring `tvdbId`: the other two are resolved server-side and are slower.

## Read Media Data

### Movie Example

```ts
const movie = await client.getMedia({
  tvdbId: 169,
  durationMs: 7_200_000,
});
```

### TV Episode Example

```ts
const episode = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
});
```

### The Three Response Shapes

`getMedia()` returns one of three shapes, discriminated by `kind`:

- `kind: 'media'`: the grouped skip timestamps (`MediaRecord`)
- `kind: 'versions'`: the release-version list, when you pass `listVersions: true`
- `kind: 'episodes'`: a per-episode submission-count fallback

```ts
const result = await client.getMedia({ tvdbId: 169 });

if (result.kind === 'media') {
  console.log(result.intro, result.credits);
} else if (result.kind === 'versions') {
  console.log(result.versions);
} else {
  console.log(result.episodes);
}
```

### Episode Order (`mapping`)

Every submission is stored in TVDB's `default` order. If your `season`/`episode` numbers come from a different order, pass `mapping` and the API converts them. Omitted means `default`.

Canonical orders: `default`, `official`, `dvd`, `alternate`, `absolute`, `regional`. The Jellyfin spellings are accepted too (`aired`, `altdvd`, `alttwo`, `streaming`, ...) and are canonicalised before the request is sent.

```ts
const episode = await client.getMedia({
  tvdbId: 71663,
  mapping: 'dvd',
  season: 1,
  episode: 1,
});
```

### Extra Detail

`details: true` adds `confidence` and `submissionCount` to each returned segment and `groupDurationMs` to the body.

```ts
const episode = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
  details: true,
});
```

### Optional Current-User Key

`getMedia()` is public. If you provide the current user's API key, the API can include that user's pending submissions in the weighted result.

```ts
const media = await client.getMedia(
  {
    tvdbId: 169,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Submit Timestamps

`submitMediaTimestamp()` always requires the current user's API key.

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tvdbId: 169,
    type: 'movie',
    segment: 'intro',
    videoDurationMs: 7_200_000,
    startSec: 30.5,
    endSec: 90.2,
  },
  {
    apiKey: currentUserApiKey,
  }
);

const { ok, submissions } = submissionResult;
```

## Preview A Submission With `mapSubmission()`

`mapSubmission()` is a dry run of `/submit`. It resolves exactly as a real submission would and returns the resolved TVDB coordinates without storing anything. It requires the current user's API key.

```ts
const resolved = await client.mapSubmission(
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

console.log(resolved.season, resolved.episode, resolved.episodeTitle);
```

## Time Format Rules

Use exactly one format:

- `startSec` and `endSec`
- `startMs` and `endMs`

Do not mix seconds and milliseconds in the same submission.

## Timestamp Semantics

- `intro` and `recap`: `null` or `0` starts are normalized to `0`
- `credits` and `preview`: `null` ends stay `null`
- Normalized results include:
  - `startsAtBeginning`
  - `endsAtMediaEnd`
  - `durationMs`

## How TheIntroDB Returns Time Data

For `GET /media`, TheIntroDB returns raw timestamps in milliseconds using `start_ms` and `end_ms`.

Example:

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

Meaning:

- `start_ms: null` means the segment starts at the beginning of the media
- `end_ms: null` means the segment reaches the end of the media
- Each segment type is an array because the API can return multiple timestamp ranges for the same kind of segment
- If a segment type has no data, that property may be omitted from the response

This package maps that raw shape into a normalized runtime shape:

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
}
```

For `POST /submit`, the API accepts either:

- seconds with decimals: `startSec` and `endSec`
- integer milliseconds: `startMs` and `endMs`

The package validates the input format and converts seconds to millisecond request values before sending the request.

## Logging

Logging is optional.

You can omit the logger entirely:

```ts
const quietClient = createIntroDbClient();
```

Or pass `console`:

```ts
const debugClient = createIntroDbClient({
  logger: console,
});
```

The package logs when:

- `getMedia()` uses a current-user API key
- `submitMediaTimestamp()` sends a submission with a current-user API key
- `mapSubmission()` resolves a mapping with a current-user API key
- `submitMediaTimestamp()` or `mapSubmission()` is called without the required user API key
