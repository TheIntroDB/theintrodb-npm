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
const result = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    startSec: 30,
    endSec: 90,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Credits Submission In Seconds With Null End

```ts
const result = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
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

## Intro Submission In Milliseconds

```ts
const result = await client.submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    startMs: 30000,
    endMs: 90000,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Standalone Functions Instead Of A Client

```ts
import { getMedia, submitMediaTimestamp } from 'theintrodb';

const media = await getMedia({ tmdbId: 12345 }, { logger: console });

await submitMediaTimestamp(
  {
    tmdbId: 12345,
    type: 'movie',
    segment: 'intro',
    startSec: 0,
    endSec: 90,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```
