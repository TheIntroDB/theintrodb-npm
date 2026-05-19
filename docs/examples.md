## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

# Usage Examples

## Public Movie Lookup

```ts
import { createIntroDbClient } from 'theintrodb';

const client = createIntroDbClient();

const media = await client.getMedia({
  tmdbId: 12345,
});
```

## Public Movie Lookup With Video Duration

Providing `durationMs` is optional but very highly recommended. It helps the API select the closest matching release version (theatrical, extended cut, etc.).

```ts
const media = await client.getMedia({
  tmdbId: 12345,
  durationMs: 7_200_000,
});
```

## Public TV Episode Lookup

```ts
const media = await client.getMedia({
  tmdbId: 67890,
  season: 1,
  episode: 1,
});
```

## IMDB-Based Lookup

```ts
const media = await client.getMedia({
  imdbId: 'tt0111161',
});
```

Use `tmdbId` whenever possible. `imdbId` is supported, but the API docs note that TMDB is the preferred canonical identifier.

## Read With A Current User API Key

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

This can include the current user's pending submissions in the weighted result.

## Intro Submission In Seconds

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    videoDurationMs: 7_200_000,
    startSec: 30,
    endSec: 90,
  },
  {
    apiKey: currentUserApiKey,
  }
);

const submissions = submissionResult.submissions;
```

## Credits Submission In Seconds With Null End

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'tv',
    season: 1,
    episode: 1,
    segment: 'credits',
    videoDurationMs: 2_760_000,
    startSec: 2400,
    endSec: null,
  },
  {
    apiKey: currentUserApiKey,
  }
);

const submissions = submissionResult.submissions;
```

## Intro Submission In Milliseconds

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    videoDurationMs: 7_200_000,
    startMs: 30000,
    endMs: 90000,
  },
  {
    apiKey: currentUserApiKey,
  }
);

const submissions = submissionResult.submissions;
```

## Standalone Functions Instead Of A Client

```ts
import { getMedia, submitMediaTimestamp } from 'theintrodb';

const media = await getMedia(
  { tmdbId: 12345, durationMs: 7_200_000 },
  { logger: console }
);

await submitMediaTimestamp(
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
