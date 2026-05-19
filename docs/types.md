## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

# Types

## Exported Constants

### MEDIA_TYPES

Readonly array of supported media kinds:

- `'movie'`
- `'tv'`

### SEGMENT_TYPES

Readonly array of supported segment kinds:

- `'intro'`
- `'recap'`
- `'credits'`
- `'preview'`

### SUBMISSION_STATUSES

Readonly array of submission states:

- `'pending'`
- `'accepted'`
- `'rejected'`

## Core Client Types

### TIDBClient

Returned by `createIntroDbClient()`.

Methods:

- `getMedia(params, requestOptions?)`
- `submitMediaTimestamp(input, requestOptions?)`

### TIDBClientOptions

Shared options for a reusable client instance.

Fields:

- `baseUrl?`
- `apiKey?`
- `headers?`
- `fetch?`
- `logger?`

### TIDBRequestOptions

Per-request overrides for client methods.

Fields:

- `apiKey?`
- `headers?`
- `logger?`
- `signal?`

### TIDBTransportOptions

Transport options used by standalone functions.

Fields:

- `baseUrl?`
- `apiKey?`
- `headers?`
- `fetch?`
- `logger?`
- `signal?`

### TIDBLogger

Optional logging interface.

Methods:

- `debug?(message, context?)`
- `info?(message, context?)`
- `warn?(message, context?)`
- `error?(message, context?)`

## Media Types

### MediaType

Union of:

- `'movie'`
- `'tv'`

### SegmentType

Union of:

- `'intro'`
- `'recap'`
- `'credits'`
- `'preview'`

### SubmissionStatus

Union of:

- `'pending'`
- `'accepted'`
- `'rejected'`

## Request Types

### GetMediaParams

Fields:

- `tmdbId?`
- `imdbId?`
- `season?`
- `episode?`
- `durationMs?`

Notes:

- provide `tmdbId` for movies
- provide `tmdbId`, `season`, and `episode` for TV episodes
- `imdbId` is supported when TMDB is not available
- `durationMs` is optional but very highly recommended; it helps the API select the closest matching release version (theatrical, extended cut, DVD release, etc.)

### SubmitMediaBase

Shared base fields for submission inputs.

Fields:

- `tmdbId`
- `imdbId?`
- `tvdbId?`
- `type`
- `segment`
- `season?`
- `episode?`
- `videoDurationMs?`

### SubmitMediaSecondsInput

Seconds-based submission.

Fields:

- `startSec?`
- `endSec?`

### SubmitMediaMillisecondsInput

Milliseconds-based submission.

Fields:

- `startMs?`
- `endMs?`

### SubmitMediaTimestampInput

Union of:

- `SubmitMediaSecondsInput`
- `SubmitMediaMillisecondsInput`

### SubmissionRequestPayload

Serialized raw payload sent to `/submit`.

Fields:

- `tmdb_id`
- `imdb_id?`
- `tvdb_id?`
- `type`
- `segment`
- `season?`
- `episode?`
- `video_duration_ms?`
- `start_ms?`
- `end_ms?`

## Response Types

### API Time Naming

TheIntroDB uses two different naming styles depending on context:

- raw API responses from `GET /media` use `start_ms` and `end_ms`
- raw success responses from `POST /submit` use `startMs` and `endMs`
- this package exposes normalized runtime objects using `startMs` and `endMs`

The API also uses two different time units depending on request direction:

- response times are returned in milliseconds
- submission inputs can be provided in seconds or milliseconds
- second-based submission inputs are converted to milliseconds before being sent

### SegmentTimestampRaw

Raw timestamp object from the API.

Fields:

- `start_ms`
- `end_ms`

Notes:

- used by `GET /media`
- `start_ms: null` means the segment starts at the beginning
- `end_ms: null` means the segment runs to the media end

### NormalizedSegmentTimestamp

Normalized runtime timestamp shape.

Fields:

- `startMs`
- `endMs`
- `durationMs`
- `startsAtBeginning`
- `endsAtMediaEnd`

Notes:

- `startMs` is always a number
- when the raw API used `start_ms: null`, this package returns `startMs: 0`
- `endMs` remains `null` when the raw API means "to the end of media"

### MediaResponseRaw

Raw `/media` response.

### MediaRecord

Normalized media result returned by the package.

Fields:

- `tmdbId`
- `type`
- `season?`
- `episode?`
- `intro`
- `recap`
- `credits`
- `preview`

Notes:

- `intro`, `recap`, `credits`, and `preview` are always arrays (this package normalizes missing segment properties to `[]`)
- a segment array may contain multiple entries for the same segment type (for example, some episodes have multiple recaps); this is expected and is not an error

### SubmissionDataRaw

Raw submission object from the API.

Notes:

- returned by successful `POST /submit` responses
- uses camelCase field names from the backend response: `startMs` and `endMs`
- `startMs: null` can appear for intro/recap submissions that begin at the start
- `endMs: null` can appear for credits/preview submissions that go to the end
- `videoDurationMs` is included as `null` when the backend does not associate the submission with a specific release version

### SubmissionData

Normalized submission object returned by the package.

Fields:

- `id`
- `tmdbId`
- `type`
- `segment`
- `season?`
- `episode?`
- `videoDurationMs`
- `startMs`
- `endMs`
- `durationMs`
- `startsAtBeginning`
- `endsAtMediaEnd`
- `status`
- `weight`

Notes:

- keeps `endMs: null` when the submission means "to the end of media"
- converts `startMs: null` to `startMs: 0`
- adds `durationMs`, `startsAtBeginning`, and `endsAtMediaEnd`

### SubmissionResponseRaw

Raw success response from `/submit`.

Fields:

- `submissions`

### SubmissionResponse

Normalized success response returned by the package.

Fields:

- `submissions`

## Utility Types

### RateLimitDetails

Parsed rate-limit and usage-limit metadata.

### ErrorResponse

API error body shape.

### HeadersLike

Minimal header reader contract used by the transport layer.

### FetchResponseLike

Minimal fetch response shape expected by the package.

### FetchLike

Minimal fetch function shape accepted by the package.
