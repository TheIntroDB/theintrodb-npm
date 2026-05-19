# TheIntroDB Package Docs

Welcome to the GitHub Pages documentation for the `theintrodb` NPM package.

This package is a typed TypeScript client for the TheIntroDB API. It provides runtime validation, normalized timestamp handling, optional logging, and a reusable client for reading and submitting segment timestamps.

## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

## What This Package Covers

- Public `GET /media` requests for movies and TV episodes
- Optional current-user API keys for `getMedia()` so the response can include that user's pending submissions
- Required current-user API keys for `submitMediaTimestamp()` so submissions are attached to that user account
- Local request validation before sending data to the API
- Runtime response validation after receiving JSON from the API
- Normalized timestamp handling:
  - `null` start values become `0`
  - `null` end values stay `null` to mean "end of media"

## Quick Example

```ts
import { createIntroDbClient } from 'theintrodb';

const client = createIntroDbClient({
  logger: console,
});

const movie = await client.getMedia({
  tmdbId: 12345,
  durationMs: 7_200_000,
});

const episode = await client.getMedia({
  tmdbId: 67890,
  season: 1,
  episode: 1,
});

const myPendingAwareResult = await client.getMedia(
  { tmdbId: 12345 },
  { apiKey: currentUserApiKey }
);

await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    videoDurationMs: 7_200_000,
    startSec: 0,
    endSec: 90,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Important Auth Rule

Do not use a shared application key for submissions. The API key should belong to the current user so submissions and pending visibility stay tied to that user account.
