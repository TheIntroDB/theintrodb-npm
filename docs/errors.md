## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)
- [Migrating v3 To v4](migration-v3-to-v4.md)

# Errors And Validation

## Error Classes

### TheIntroDbValidationError

Thrown when input validation fails before a request is sent.

Common cases:

- no media identity supplied (`tvdbId`, `tmdbId` and `imdbId` all missing)
- missing `season` or `episode` for a TV request
- an unknown episode order in `mapping`
- invalid `durationMs` for `getMedia()` (must be a non-negative integer number of milliseconds)
- mixed seconds and milliseconds in one submission
- invalid `videoDurationMs` for submissions (must be `0` or at least 5 minutes, and no more than 6 hours)
- using `videoDurationMs` with TV season/episode expressions (lists/ranges) instead of a single episode
- episode numbering sent for a movie
- missing current-user API key for `submitMediaTimestamp()` or `mapSubmission()`

### TheIntroDbResponseValidationError

Thrown when the server returns JSON that does not match the expected schema.

Common cases:

- missing required response fields
- wrong data types in returned JSON
- empty response body where JSON is expected

### TheIntroDbApiError

Thrown when the API responds with a non-2xx status.

Useful properties:

- `status`
- `details`
- `code`
- `body`
- `rateLimit`

## Validation Layers

This package validates in three places:

1. Before sending requests
2. After receiving JSON responses
3. During timestamp normalization

## Time-Related Validation Details

Time handling is one of the main validation responsibilities of the package.

Before a submission is sent, the package validates:

- that you use either seconds or milliseconds, but not both
- that TV submissions include `season` and `episode`
- that segment-specific null behavior is respected
- that durations and endpoints are consistent with the API rules

During parsing and normalization, the package also preserves the meaning of API time values:

- `start_ms: null` is interpreted as "start of media"
- `end_ms: null` is interpreted as "end of media"
- normalized output keeps that meaning through `startMs`, `endMs`, `startsAtBeginning`, and `endsAtMediaEnd`

## Mapping Validation

Episode orders are validated locally against the same alias set the API uses, so
a typo fails fast with a `TheIntroDbValidationError` instead of a round trip and
a `400`. Accepted spellings:

- `default`, `official`, `dvd`, `alternate`, `absolute`, `regional`
- aliases: `aired` / `airedorder` (official), `altdvd` (dvd), `alttwo` /
  `streaming` (alternate), `production` (regional), and the `*order` variants

Note that a valid order can still be refused by the API with a `400` when TVDB
does not carry that order for the requested series.

## Rate Limit Metadata

`TheIntroDbApiError.rateLimit` contains parsed values from these headers when present:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-UsageLimit-Limit`
- `X-UsageLimit-Remaining`
- `X-UsageLimit-Reset`
- `X-UsageLimit-SpecificMedia-Limit`
- `X-UsageLimit-SpecificMedia-Remaining`
- `X-UsageLimit-SpecificMedia-Reset`

The specific-media headers cap repeated requests for the same media target and
come with `code: "specific_media_usage_limit_exceeded"`.

## Example Error Handling

```ts
import {
  TheIntroDbApiError,
  TheIntroDbResponseValidationError,
  TheIntroDbValidationError,
} from 'theintrodb';

try {
  await client.submitMediaTimestamp(
    {
      tvdbId: 169,
      type: 'movie',
      segment: 'intro',
      startSec: 0,
      endSec: 90,
    },
    {
      apiKey: currentUserApiKey,
    }
  );
} catch (error) {
  if (error instanceof TheIntroDbValidationError) {
    console.error('Input problem:', error.issues);
  } else if (error instanceof TheIntroDbResponseValidationError) {
    console.error('Unexpected API response:', error.body);
  } else if (error instanceof TheIntroDbApiError) {
    console.error('API failure:', error.status, error.code, error.rateLimit);
  } else {
    throw error;
  }
}
```
