## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

# Usage Examples

## Public Movie Lookup

```ts
import { createIntroDbClient } from 'theintrodb';

const client = createIntroDbClient();

const media = await client.getMedia({
  tvdbId: 169,
});
```

## Public Movie Lookup With Video Duration

Providing `durationMs` is optional but very highly recommended. It helps the API select the closest matching release version (theatrical, extended cut, etc.).

```ts
const media = await client.getMedia({
  tvdbId: 169,
  durationMs: 7_200_000,
});
```

## Public TV Episode Lookup

```ts
const media = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
});
```

## Narrowing The Response Union

`getMedia()` returns one of three shapes. Check `kind` before reading segment arrays.

```ts
const result = await client.getMedia({ tvdbId: 71663, season: 1, episode: 1 });

if (result.kind === 'media') {
  for (const segment of result.intro) {
    console.log(segment.startMs, segment.endMs);
  }
}
```

## Listing Release Versions

Pass `listVersions: true` to inspect the release versions (duration clusters) the media has submissions for.

```ts
const result = await client.getMedia({
  tvdbId: 169,
  listVersions: true,
});

if (result.kind === 'versions') {
  console.log(result.versions);
  // [{ durationMs: 7200000, averageDurationMs: 7195000, submissionCount: 14 }]
}
```

## Requesting Segment Detail

`details: true` adds `confidence` and `submissionCount` to each segment.

```ts
const result = await client.getMedia({
  tvdbId: 71663,
  season: 1,
  episode: 1,
  details: true,
});

if (result.kind === 'media') {
  console.log(result.groupDurationMs, result.intro[0]?.confidence);
}
```

## IMDB-Addressed Lookup

```ts
const media = await client.getMedia({
  imdbId: 'tt0111161',
});
```

Prefer `tvdbId` whenever possible. `tmdbId` and `imdbId` are resolved server-side and are slower.

## Reading In A Different Episode Order

If your `season`/`episode` numbers come from the DVD order, say so and the API converts them into the stored `default` order.

```ts
const media = await client.getMedia({
  tvdbId: 71663,
  mapping: 'dvd',
  season: 1,
  episode: 1,
});
```

## Read With A Current User API Key

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

This can include the current user's pending submissions in the weighted result.

## Intro Submission In Seconds

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tvdbId: 169,
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

const { ok, submissions } = submissionResult;
```

## Credits Submission In Seconds With Null End

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tvdbId: 71663,
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
```

## Intro Submission In Milliseconds

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tvdbId: 169,
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
```

## Submitting Across A Range Of Episodes

A TV `season`/`episode` may be a list or range. The API writes one submission per pair.

```ts
const submissionResult = await client.submitMediaTimestamp(
  {
    tvdbId: 71663,
    type: 'tv',
    season: '1',
    episode: '1-3',
    segment: 'recap',
    startMs: 25000,
    endMs: 134000,
  },
  {
    apiKey: currentUserApiKey,
  }
);
```

## Previewing Where A Submission Will Land

`mapSubmission()` resolves without storing anything.

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

console.log(resolved.season, resolved.episode, resolved.tvdbEpisodeId);
```

## Standalone Functions Instead Of A Client

```ts
import { getMedia, mapSubmission, submitMediaTimestamp } from 'theintrodb';

const media = await getMedia(
  { tvdbId: 169, durationMs: 7_200_000 },
  { logger: console }
);

await submitMediaTimestamp(
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

await mapSubmission(
  { tvdbId: 71663, type: 'tv', season: '1', episode: '1' },
  { apiKey: currentUserApiKey }
);
```
