## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

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

- `baseUrl`: Override the API base URL. Defaults to `https://api.theintrodb.org/v3`.
- `apiKey`: Optional current-user API key. Useful if you want a client instance that always acts on behalf of one user.
- `headers`: Additional headers merged into each request.
- `fetch`: Custom fetch implementation for tests, Node runtimes, or other environments.
- `logger`: Optional TIDB logger. Pass `console` for simple logging, or omit it to disable logs.

## Read Media Data

### Movie Example

```ts
const movie = await client.getMedia({
  tmdbId: 12345,
  durationMs: 7_200_000,
});
```

### TV Episode Example

```ts
const episode = await client.getMedia({
  tmdbId: 67890,
  season: 1,
  episode: 1,
});
```

### Optional Current-User Key

`getMedia()` is public. If you provide the current user's API key, the API can include that user's pending submissions in the weighted result.

```ts
const media = await client.getMedia(
  {
    tmdbId: 12345,
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
    tmdbId: 12345,
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

const submissions = submissionResult.submissions;
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
  "tmdb_id": 12345,
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
- `submitMediaTimestamp()` is called without a required user API key
