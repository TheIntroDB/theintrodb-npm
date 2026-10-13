## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

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

### EPISODE_ORDERS

Readonly array of canonical TVDB episode orders accepted as a `mapping`:

- `'default'`
- `'official'`
- `'dvd'`
- `'alternate'`
- `'absolute'`
- `'regional'`

### EPISODE_ORDER_ALIASES

Record mapping every accepted `mapping` spelling to its canonical
`EpisodeOrder`. It mirrors the API's alias set, so the same spellings the server
accepts are accepted (and canonicalised) by the package before a request is sent.
Besides the six canonical names it carries:

- `'defaultorder'`
- `'officialorder'`, `'aired'`, `'airedorder'`
- `'altdvd'`, `'dvdorder'`
- `'absoluteorder'`, `'abso'`
- `'alternateorder'`, `'alttwo'`, `'streaming'`, `'streamingorder'`
- `'regionalorder'`, `'production'`, `'productionorder'`

### MEDIA_RESPONSE_KINDS

Readonly array of `GET /media` response discriminants:

- `'media'`
- `'versions'`
- `'episodes'`

## Core Client Types

### TIDBClient

Returned by `createIntroDbClient()`.

Methods:

- `getMedia(params, requestOptions?)`
- `mapSubmission(input, requestOptions?)`
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

### EpisodeOrder

Union of the six canonical TVDB orders. See `EPISODE_ORDERS`.

### EpisodeOrderInput

`EpisodeOrder | string`: a canonical order name or any accepted alias. Aliases
are canonicalised by the package before a request is sent.

### EpisodeSelection

`number | string`. The string form may be a single number (`'1'`), a
comma-separated list (`'1,2'`), an ascending range (`'1-3'`), or a mix
(`'1,3-4,6'`).

## Request Types

### GetMediaParams

Fields:

- `tvdbId?`
- `tmdbId?`
- `imdbId?`
- `season?`
- `episode?`
- `mapping?`
- `tvdbEpisodeId?`
- `episodeName?`
- `episodeTitle?`
- `durationMs?`
- `listVersions?`
- `mergeUnknown?`
- `details?`

Notes:

- provide exactly one identity: `tvdbId` (preferred), `tmdbId` or `imdbId`
- provide `season` and `episode` together for TV episodes; omit both for movies
- `durationMs` is optional but very highly recommended; it helps the API select the closest matching release version (theatrical, extended cut, DVD release, etc.)
- `mapping` is only meaningful for TV; omit it for movies
- `mergeUnknown` is left to the API default (`true`) unless you set it

### SubmitMediaBase

Shared base fields for submission inputs.

Fields:

- `tvdbId?`
- `tmdbId?`
- `imdbId?`
- `type`
- `segment`
- `season?`
- `episode?`
- `mapping?`
- `tvdbEpisodeId?`
- `episodeName?`
- `episodeTitle?`
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

- `type`
- `segment`
- `tvdb_id?`
- `tmdb_id?`
- `imdb_id?`
- `season?`
- `episode?`
- `mapping?`
- `tvdb_episode_id?`
- `episode_name?`
- `episode_title?`
- `video_duration_ms?`
- `start_ms?`
- `end_ms?`

### MapSubmissionInput

Parameters accepted by `mapSubmission()`.

Fields:

- `type`
- `tvdbId?`
- `tmdbId?`
- `imdbId?`
- `season?`
- `episode?`
- `mapping?`
- `tvdbEpisodeId?`
- `episodeName?`
- `episodeTitle?`

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
- `confidence?` (only present when `details=true`)
- `submission_count?` (only present when `details=true`)

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
- `confidence?`
- `submissionCount?`

Notes:

- `startMs` is always a number
- when the raw API used `start_ms: null`, this package returns `startMs: 0`
- `endMs` remains `null` when the raw API means "to the end of media"
- `confidence` and `submissionCount` are only present when `details=true` was requested

### MediaResponseRaw

Raw grouped-timestamps `/media` response.

### MediaVersionRaw / MediaVersion

A release version (a duration cluster) in raw and normalized form.

### MediaVersionsRaw / MediaVersions

The `list_versions=true` response in raw and normalized form.

### MediaEpisodeSummaryRaw / MediaEpisodeSummary

Per-episode submission counts in raw and normalized form.

### MediaEpisodeListRaw / MediaEpisodeList

The episode-list fallback response in raw and normalized form.

### MediaRecord

Normalized grouped-timestamps media result (`kind: 'media'`).

Fields:

- `kind` (always `'media'`)
- `tvdbId`
- `type`
- `season?`
- `episode?`
- `groupDurationMs` (only non-null when `details=true`)
- `intro`
- `recap`
- `credits`
- `preview`

Notes:

- `intro`, `recap`, `credits`, and `preview` are always arrays (this package normalizes missing segment properties to `[]`)
- a segment array may contain multiple entries for the same segment type (for example, some episodes have multiple recaps); this is expected and is not an error

### MediaVersions

Normalized release-version list (`kind: 'versions'`).

Fields:

- `kind` (always `'versions'`)
- `tvdbId`
- `type`
- `season?`
- `episode?`
- `versions` (array of `MediaVersion`)

### MediaEpisodeList

Normalized episode-list fallback (`kind: 'episodes'`).

Fields:

- `kind` (always `'episodes'`)
- `tvdbId`
- `type`
- `episodes` (array of `MediaEpisodeSummary`)

### MediaResponse

`MediaRecord | MediaVersions | MediaEpisodeList`. Narrow it with `kind`.

### SubmissionDataRaw

Raw submission object from the API.

Notes:

- returned by successful `POST /submit` responses
- the identity field is `tvdbId` (camelCase) and may be `null` only in a response that predates the field
- uses camelCase field names from the backend response: `startMs` and `endMs`
- `startMs: null` can appear for intro/recap submissions that begin at the start
- `endMs: null` can appear for credits/preview submissions that go to the end
- `videoDurationMs` is included as `null` when the backend does not associate the submission with a specific release version

### SubmissionData

Normalized submission object returned by the package.

Fields:

- `id`
- `tvdbId` (`number | null`)
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

### SubmissionResponseRaw / SubmissionResponse

Raw and normalized success response from `/submit`.

Fields:

- `ok` (always `true` on a `200`)
- `submissions`

### MapResponseRaw / MapResult

Raw and normalized success response from `/map`.

Fields:

- `tvdbId`
- `type`
- `mapping` (the order the caller's numbers were read in, canonicalised)
- `mediaTitle?`
- `season?`
- `episode?`
- `tvdbEpisodeId?`
- `episodeTitle?`

## Utility Types

### RateLimitDetails

Parsed rate-limit and usage-limit metadata, including the specific-media usage
cap:

- `rateLimit`, `rateLimitRemaining`, `rateLimitResetSeconds`
- `usageLimit`, `usageRemaining`, `usageResetSeconds`
- `specificMediaLimit`, `specificMediaRemaining`, `specificMediaResetSeconds`

### ErrorResponse

API error body shape.

### HeadersLike

Minimal header reader contract used by the transport layer.

### FetchResponseLike

Minimal fetch response shape expected by the package.

### FetchLike

Minimal fetch function shape accepted by the package.
