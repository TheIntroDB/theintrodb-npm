# TheIntroDB Package Docs

Welcome to the GitHub Pages documentation for the `theintrodb` NPM package.

This package is a typed TypeScript client for the TheIntroDB API (v4). It provides runtime validation, normalized timestamp handling, optional logging, and a reusable client for reading and submitting segment timestamps.

## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

## What This Package Covers

- Public `GET /media` requests for movies and TV episodes, with TVDB (`tvdbId`) as the identity
- Release-version listing (`listVersions`) and the episode-list fallback, exposed as a discriminated union on `kind`
- Optional current-user API keys for `getMedia()` so the response can include that user's pending submissions
- Required current-user API keys for `submitMediaTimestamp()` and `mapSubmission()` so requests act on that user account
- Episode-order `mapping` support, including the Jellyfin (media-server) spellings
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
  tvdbId: 169,
  durationMs: 7_200_000,
});

const episode = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
});

if (movie.kind === 'media') {
  console.log(movie.intro);
}

const myPendingAwareResult = await client.getMedia(
  { tvdbId: 169 },
  { apiKey: currentUserApiKey }
);

await client.submitMediaTimestamp(
  {
    tvdbId: 169,
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

// Dry run: where would this submission land?
const resolved = await client.mapSubmission(
  { tvdbId: 71663, type: 'tv', mapping: 'dvd', season: '1', episode: '1' },
  { apiKey: currentUserApiKey }
);
```

## Important Auth Rule

Do not use a shared application key for submissions. The API key should belong to the current user so submissions and pending visibility stay tied to that user account.
