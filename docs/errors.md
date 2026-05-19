## Navigation

- [Getting Started](getting-started.md)
- [Usage Examples](examples.md)
- [Functions](functions.md)
- [Types](types.md)
- [Errors And Validation](errors.md)

# Errors And Validation

## Error Classes

### TheIntroDbValidationError

Thrown when input validation fails before a request is sent.

Common cases:

- missing `tmdbId` and `imdbId` for `getMedia()`
- missing `season` or `episode` for TV requests
- invalid `durationMs` for `getMedia()` (must be a non-negative integer number of milliseconds)
- mixed seconds and milliseconds in one submission
- invalid `videoDurationMs` for submissions (must be `0` or at least 5 minutes, and no more than 6 hours)
- using `videoDurationMs` with TV season/episode expressions (lists/ranges) instead of a single episode
- missing current-user API key for `submitMediaTimestamp()`

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

## Rate Limit Metadata

`TheIntroDbApiError.rateLimit` contains parsed values from these headers when present:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-UsageLimit-Limit`
- `X-UsageLimit-Remaining`
- `X-UsageLimit-Reset`

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
