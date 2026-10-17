## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

# Functions

## createIntroDbClient(options?)

Creates a reusable TIDB client.

### Signature

```ts
createIntroDbClient(options?: TIDBClientOptions): TIDBClient
```

### Use This When

- You want shared `baseUrl`, `fetch`, `headers`, `logger`, or `apiKey`
- You prefer method-based access: `client.getMedia()`, `client.submitMediaTimestamp()` and `client.mapSubmission()`

## getMedia(params, transportOptions?)

Fetches timestamps for a movie or TV episode, its release versions, or a per-episode submission-count fallback.

### Signature

```ts
getMedia(
  params: GetMediaParams,
  transportOptions?: TIDBTransportOptions
): Promise<MediaResponse>
```

### Auth

- No auth required
- Optional current-user API key supported
- When a current-user key is supplied, the API can include that user's pending submissions in the response

### Params

- `tvdbId`: Preferred identity
- `tmdbId`, `imdbId`: Alternate identities, resolved server-side (slower)
- `season`, `episode`: provide together for a TV episode lookup (`0` addresses specials)
- `mapping`: the episode order your numbers are in; omitted means `default`
- `tvdbEpisodeId`: pins one exact TVDB episode record
- `episodeName` / `episodeTitle`: optional title hint corroborating the resolved episode
- `durationMs`: optional total video duration in milliseconds used by the API to select the closest matching release version (theatrical, extended cut, etc.)
- `listVersions`: return the release-version list instead of skip timestamps
- `mergeUnknown`: whether no-known-duration submissions join the selected release group (API default `true`)
- `details`: include `confidence`/`submissionCount` per segment and `groupDurationMs`

### Returns

A `MediaResponse`, one of:

- `MediaRecord` (`kind: 'media'`)
- `MediaVersions` (`kind: 'versions'`)
- `MediaEpisodeList` (`kind: 'episodes'`)

### Raw API Time Shape

The API returns media timestamps in milliseconds using raw snake_case fields:

```json
{
  "start_ms": 30000,
  "end_ms": 90000
}
```

Special cases:

- `start_ms: null` means "starts at the beginning"
- `end_ms: null` means "runs to the end of the media"
- segment properties such as `intro` or `credits` may be omitted if no data exists
- segment properties are arrays and may contain multiple entries for the same segment type; this is expected for some media and is not an error. Use all segments.

## submitMediaTimestamp(input, transportOptions?)

Submits a single segment timestamp payload.

### Signature

```ts
submitMediaTimestamp(
  input: SubmitMediaTimestampInput,
  transportOptions?: TIDBTransportOptions
): Promise<SubmissionResponse>
```

### Auth

- Always requires the current user's API key
- The key should belong to the end user
- The package throws before making the request if the key is missing

### Input Rules

- Provide one identity: `tvdbId` (preferred), `tmdbId` or `imdbId`
- Use either seconds or milliseconds, not both
- `intro` and `recap` allow `null` starts
- `credits` and `preview` allow `null` ends
- TV submissions require `season` and `episode`; a string may be a list or range (`'1,2'`, `'1-3'`, `'1,3-4,6'`)
- Movie submissions must omit `season`, `episode`, `mapping` and `tvdbEpisodeId`
- `mapping` states the episode order your numbers are in; an unknown order is rejected locally
- `videoDurationMs` is optional but highly recommended; it helps associate the submission with a release version for matching. It must be `0` (unknown) or between 5 minutes and 6 hours

## mapSubmission(input, transportOptions?)

Resolves a submission to its TVDB mapping without storing it. A dry run of `POST /submit`: a request that would be rejected on submit is rejected here with the same error.

### Signature

```ts
mapSubmission(
  input: MapSubmissionInput,
  transportOptions?: TIDBTransportOptions
): Promise<MapResult>
```

### Auth

- Always requires the current user's API key

### Input Rules

- Same identity, `mapping` and hint rules as `submitMediaTimestamp()`, minus the timestamps
- A list or range of seasons/episodes cannot be reported as a single mapping; the API refuses it with `400`
- Movie submissions must omit `season`, `episode`, `mapping` and `tvdbEpisodeId`

### Returns

A `MapResult` with the resolved `tvdbId`, `type`, canonical `mapping`, and (for TV) `season`, `episode`, `tvdbEpisodeId`, `episodeTitle` and `mediaTitle` when available.

## buildMediaQuery(params)

Builds the query string used for `/media`.

### Signature

```ts
buildMediaQuery(params: GetMediaParams): URLSearchParams
```

### Use This When

- You want to inspect or reuse the generated query parameters
- You want package-level validation before making your own fetch call

## serializeSubmissionRequest(input)

Validates and converts a high-level submission input into the raw `/submit` request body.

### Signature

```ts
serializeSubmissionRequest(
  input: SubmitMediaTimestampInput
): SubmissionRequestPayload
```

### Normalization Rules

- `intro` and `recap` starts of `0` or `null` become `start_ms: null`
- `credits` and `preview` null ends stay `end_ms: null`
- `mapping` aliases are canonicalised (for example `'altdvd'` becomes `'dvd'`)
- `videoDurationMs` is sent as `video_duration_ms` when provided
- seconds are rounded to milliseconds
- The outgoing API payload always uses millisecond field names: `start_ms` and `end_ms`

## serializeMapRequest(input)

Validates and converts a high-level map input into the raw `/map` request body. It carries no timestamps.

### Signature

```ts
serializeMapRequest(input: MapSubmissionInput): Record<string, unknown>
```

## parseMediaResponse(body)

Validates raw JSON against the `/media` schemas and returns the matching normalized shape, choosing between the media, versions and episode-list bodies.

### Signature

```ts
parseMediaResponse(body: unknown): MediaResponse
```

### What It Normalizes

- `start_ms` becomes `startMs`
- `end_ms` becomes `endMs`
- `start_ms: null` becomes `startMs: 0`
- `end_ms: null` stays `endMs: null`
- derived fields such as `durationMs`, `startsAtBeginning`, and `endsAtMediaEnd` are added
- snake_case response fields become camelCase (`tvdb_id` becomes `tvdbId`, `group_duration_ms` becomes `groupDurationMs`, and so on)

## parseMediaRecord(body)

Validates and normalizes the grouped-timestamps `/media` body (the default shape).

### Signature

```ts
parseMediaRecord(body: unknown): MediaRecord
```

## parseMediaVersions(body)

Validates and normalizes the `list_versions` `/media` body.

### Signature

```ts
parseMediaVersions(body: unknown): MediaVersions
```

## parseMediaEpisodes(body)

Validates and normalizes the episode-list fallback `/media` body.

### Signature

```ts
parseMediaEpisodes(body: unknown): MediaEpisodeList
```

## parseSubmissionResponse(body)

Validates raw JSON against the expected `/submit` schema and returns a normalized `SubmissionResponse`.

### Signature

```ts
parseSubmissionResponse(body: unknown): SubmissionResponse
```

## parseMapResponse(body)

Validates raw JSON against the expected `/map` schema and returns a normalized `MapResult`.

### Signature

```ts
parseMapResponse(body: unknown): MapResult
```

## normalizeSegmentTimestamp(timestamp)

Normalizes a raw segment timestamp into the package's runtime format.

### Signature

```ts
normalizeSegmentTimestamp(
  timestamp: SegmentTimestampRaw
): NormalizedSegmentTimestamp
```

### Output Behavior

- `start_ms: null` becomes `startMs: 0`
- `end_ms: null` stays `endMs: null`
- `durationMs` is `null` if the end is unknown
- `startsAtBeginning` and `endsAtMediaEnd` preserve the meaning of the original `null` values

## normalizeEpisodeOrder(name)

Resolves a `mapping` spelling to its canonical TVDB episode order, or `undefined` when the spelling is unknown.

### Signature

```ts
normalizeEpisodeOrder(name: string): EpisodeOrder | undefined
```

### Behavior

- Case, spaces, dashes and underscores are ignored
- TVDB names and Jellyfin `displayorder` spellings are both accepted

```ts
normalizeEpisodeOrder('Aired-Order'); // 'official'
normalizeEpisodeOrder('altdvd'); // 'dvd'
normalizeEpisodeOrder('streaming'); // 'alternate'
normalizeEpisodeOrder('nope'); // undefined
```
