## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

# Functions

## createIntroDbClient(options?)

Creates a reusable TIDB client.

### Signature

```ts
createIntroDbClient(options?: TIDBClientOptions): TIDBClient
```

### Use This When

- You want shared `baseUrl`, `fetch`, `headers`, `logger`, or `apiKey`
- You prefer method-based access: `client.getMedia()` and `client.submitMediaTimestamp()`

## getMedia(params, transportOptions?)

Fetches timestamps for a movie or TV episode.

### Signature

```ts
getMedia(
  params: GetMediaParams,
  transportOptions?: TIDBTransportOptions
): Promise<MediaRecord>
```

### Auth

- No auth required
- Optional current-user API key supported
- When a current-user key is supplied, the API can include that user's pending submissions in the response

### Params

- `tmdbId`: Preferred canonical identifier
- `imdbId`: Optional fallback identifier
- `season`: Required with `episode` for TV episode lookups
- `episode`: Required with `season` for TV episode lookups
- `durationMs`: Optional total video duration in milliseconds used by the API to select the closest matching release version (theatrical, extended cut, etc.)

### Returns

A normalized `MediaRecord`.

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

- Use either seconds or milliseconds, not both
- `intro` and `recap` allow `null` starts
- `credits` and `preview` allow `null` ends
- TV submissions require `season` and `episode`
- Movie submissions must omit `season` and `episode`
- `videoDurationMs` is optional but highly recommended; it helps associate the submission with a release version for matching

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
- `videoDurationMs` is sent as `video_duration_ms` when provided
- seconds are rounded to milliseconds
- The outgoing API payload always uses millisecond field names: `start_ms` and `end_ms`

## parseMediaResponse(body)

Validates raw JSON against the expected `/media` schema and returns a normalized `MediaRecord`.

### Signature

```ts
parseMediaResponse(body: unknown): MediaRecord
```

### What It Normalizes

- `start_ms` becomes `startMs`
- `end_ms` becomes `endMs`
- `start_ms: null` becomes `startMs: 0`
- `end_ms: null` stays `endMs: null`
- derived fields such as `durationMs`, `startsAtBeginning`, and `endsAtMediaEnd` are added

## parseSubmissionResponse(body)

Validates raw JSON against the expected `/submit` schema and returns a normalized `SubmissionResponse`.

### Signature

```ts
parseSubmissionResponse(body: unknown): SubmissionResponse
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
