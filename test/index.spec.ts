import {
  TheIntroDbApiError,
  TheIntroDbResponseValidationError,
  TheIntroDbValidationError,
  createIntroDbClient,
  getMedia,
  normalizeSegmentTimestamp,
  parseMediaResponse,
  serializeSubmissionRequest,
  submitMediaTimestamp,
} from '../src';
import {
  FetchLike,
  FetchResponseLike,
  HeadersLike,
  TIDBLogger,
} from '../src/types';

function createHeaders(values: Record<string, string> = {}): HeadersLike {
  const normalized = Object.entries(values).reduce<Record<string, string>>(
    (result, [key, value]) => {
      result[key.toLowerCase()] = value;
      return result;
    },
    {}
  );

  return {
    get(name: string): string | null {
      return normalized[name.toLowerCase()] ?? null;
    },
  };
}

function createResponse(options: {
  status?: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): FetchResponseLike {
  const status = options.status ?? 200;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: options.statusText ?? 'OK',
    headers: createHeaders(options.headers),
    text(): Promise<string> {
      return Promise.resolve(
        options.body == null ? '' : JSON.stringify(options.body)
      );
    },
  };
}

function createFetchMock(
  response: FetchResponseLike
): jest.MockedFunction<FetchLike> {
  return jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(() =>
    Promise.resolve(response)
  );
}

function createLogger(): Required<TIDBLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('TheIntroDB package', () => {
  describe('baseUrl sanitization', () => {
    it('converts http to https in baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tmdb_id: 12345,
            type: 'movie',
            intro: [],
            credits: [],
          },
        })
      );

      await getMedia(
        { tmdbId: 12345 },
        { fetch: fetchMock, baseUrl: 'http://api.theintrodb.org/v3' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.theintrodb.org/v3/media?tmdb_id=12345',
        expect.any(Object)
      );
    });

    it('prepends https if no protocol is given in baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tmdb_id: 12345,
            type: 'movie',
            intro: [],
            credits: [],
          },
        })
      );

      await getMedia(
        { tmdbId: 12345 },
        { fetch: fetchMock, baseUrl: 'api.theintrodb.org/v3' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.theintrodb.org/v3/media?tmdb_id=12345',
        expect.any(Object)
      );
    });

    it('strips trailing slashes from baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tmdb_id: 12345,
            type: 'movie',
            intro: [],
            credits: [],
          },
        })
      );

      await getMedia(
        { tmdbId: 12345 },
        { fetch: fetchMock, baseUrl: 'https://api.theintrodb.org/v3/' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.theintrodb.org/v3/media?tmdb_id=12345',
        expect.any(Object)
      );
    });
  });

  it('normalizes null timestamps from media responses', async () => {
    const fetchMock = createFetchMock(
      createResponse({
        body: {
          tmdb_id: 12345,
          type: 'movie',
          intro: [{ start_ms: null, end_ms: 90000 }],
          credits: [
            { start_ms: 0, end_ms: 90000 },
            { start_ms: 1800000, end_ms: null },
          ],
        },
      })
    );

    const result = await getMedia(
      { tmdbId: 12345 },
      { fetch: fetchMock, baseUrl: 'https://api.theintrodb.org/v3' }
    );

    expect(result.intro[0]).toEqual({
      startMs: 0,
      endMs: 90000,
      durationMs: 90000,
      startsAtBeginning: true,
      endsAtMediaEnd: false,
    });
    expect(result.credits[1]).toEqual({
      startMs: 1800000,
      endMs: null,
      durationMs: null,
      startsAtBeginning: false,
      endsAtMediaEnd: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.theintrodb.org/v3/media?tmdb_id=12345',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
  });

  it('includes duration_ms when requested', async () => {
    const fetchMock = createFetchMock(
      createResponse({
        body: {
          tmdb_id: 12345,
          type: 'movie',
          intro: [{ start_ms: null, end_ms: 90000 }],
        },
      })
    );

    const result = await getMedia(
      { tmdbId: 12345, durationMs: 7200000 },
      { fetch: fetchMock, baseUrl: 'https://api.theintrodb.org/v3' }
    );

    expect(result.intro[0]).toEqual({
      startMs: 0,
      endMs: 90000,
      durationMs: 90000,
      startsAtBeginning: true,
      endsAtMediaEnd: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.theintrodb.org/v3/media?tmdb_id=12345&duration_ms=7200000',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
  });

  it('allows getMedia to use a current user API key for pending submissions', async () => {
    const fetchMock = createFetchMock(
      createResponse({
        body: {
          tmdb_id: 67890,
          type: 'tv',
          season: 1,
          episode: 2,
          preview: [{ start_ms: 1680000, end_ms: null }],
        },
      })
    );
    const logger = createLogger();
    const client = createIntroDbClient({
      fetch: fetchMock,
      logger,
    });

    const result = await client.getMedia(
      {
        imdbId: 'tt0111161',
        season: 1,
        episode: 2,
      },
      {
        apiKey: 'user-api-key',
      }
    );

    expect(result.preview[0].endMs).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.theintrodb.org/v3/media?imdb_id=tt0111161&season=1&episode=2',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer user-api-key',
        }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('pending submissions'),
      expect.objectContaining({ path: '/media' })
    );
  });

  it('serializes intro submissions with null start and credits submissions with null end', () => {
    expect(
      serializeSubmissionRequest({
        tmdbId: 12345,
        type: 'movie',
        segment: 'intro',
        startSec: 0,
        endSec: 90,
      })
    ).toEqual({
      tmdb_id: 12345,
      type: 'movie',
      segment: 'intro',
      season: undefined,
      episode: undefined,
      imdb_id: undefined,
      tvdb_id: undefined,
      video_duration_ms: undefined,
      start_ms: null,
      end_ms: 90000,
    });

    expect(
      serializeSubmissionRequest({
        tmdbId: 12345,
        type: 'movie',
        segment: 'credits',
        startMs: 1800000,
        endMs: null,
      })
    ).toEqual({
      tmdb_id: 12345,
      type: 'movie',
      segment: 'credits',
      season: undefined,
      episode: undefined,
      imdb_id: undefined,
      tvdb_id: undefined,
      video_duration_ms: undefined,
      start_ms: 1800000,
      end_ms: null,
    });
  });

  it('submits timestamps, converts seconds to milliseconds, and normalizes the response', async () => {
    const fetchMock = createFetchMock(
      createResponse({
        body: {
          submissions: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001',
              tmdbId: 67890,
              type: 'tv',
              segment: 'intro',
              season: 1,
              episode: 1,
              videoDurationMs: 7200000,
              startMs: null,
              endMs: 85200,
              status: 'accepted',
              weight: 2,
            },
          ],
        },
      })
    );
    const logger = createLogger();

    const result = await submitMediaTimestamp(
      {
        tmdbId: 67890,
        type: 'tv',
        segment: 'intro',
        season: 1,
        episode: 1,
        videoDurationMs: 7200000,
        startSec: null,
        endSec: 85.2,
      },
      { apiKey: 'submit-key', fetch: fetchMock, logger }
    );

    expect(result.submissions[0].startMs).toBe(0);
    expect(result.submissions[0].startsAtBeginning).toBe(true);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({
        tmdb_id: 67890,
        type: 'tv',
        segment: 'intro',
        season: 1,
        episode: 1,
        video_duration_ms: 7200000,
        start_ms: null,
        end_ms: 85200,
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Submitting timestamps'),
      expect.objectContaining({ path: '/submit' })
    );
  });

  it('requires the current user API key for submissions and logs the failure', async () => {
    const logger = createLogger();

    await expect(
      submitMediaTimestamp(
        {
          tmdbId: 12345,
          type: 'movie',
          segment: 'intro',
          startSec: 0,
          endSec: 90,
        },
        { logger }
      )
    ).rejects.toThrow(
      "submitMediaTimestamp requires the current user's API key"
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("current user's API key"),
      expect.objectContaining({ path: '/submit' })
    );
  });

  it('surfaces API failures with rate-limit metadata', async () => {
    const fetchMock = createFetchMock(
      createResponse({
        status: 429,
        statusText: 'Too Many Requests',
        body: {
          error: 'Usage limit exceeded',
          code: 'usage_limit_exceeded',
          retry_after: '8.4 hours',
        },
        headers: {
          'X-UsageLimit-Limit': '1000',
          'X-UsageLimit-Remaining': '0',
          'X-UsageLimit-Reset': '30240',
        },
      })
    );

    await expect(
      getMedia({ tmdbId: 12345 }, { fetch: fetchMock })
    ).rejects.toMatchObject<Partial<TheIntroDbApiError>>({
      name: 'TheIntroDbApiError',
      status: 429,
      code: 'usage_limit_exceeded',
      rateLimit: expect.objectContaining({
        usageLimit: 1000,
        usageRemaining: 0,
        usageResetSeconds: 30240,
      }),
    });
  });

  it('rejects invalid inputs and malformed response bodies', async () => {
    await expect(getMedia({})).rejects.toBeInstanceOf(
      TheIntroDbValidationError
    );

    expect(() =>
      parseMediaResponse({
        tmdb_id: 12345,
        type: 'movie',
        intro: [{ start_ms: 'bad', end_ms: 10 }],
      })
    ).toThrow(TheIntroDbResponseValidationError);
  });

  it('handles plain text responses when JSON parsing fails', async () => {
    const fetchMock = createFetchMock({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: createHeaders(),
      text(): Promise<string> {
        return Promise.resolve('<html>502 Bad Gateway</html>');
      },
    });

    await expect(
      getMedia({ tmdbId: 12345 }, { fetch: fetchMock })
    ).rejects.toMatchObject<Partial<TheIntroDbApiError>>({
      name: 'TheIntroDbApiError',
      status: 502,
      message: 'TheIntroDB API request failed with status 502.',
      body: '<html>502 Bad Gateway</html>',
    });
  });

  it('keeps direct timestamp normalization consistent for standalone utilities', () => {
    expect(normalizeSegmentTimestamp({ start_ms: null, end_ms: null })).toEqual(
      {
        startMs: 0,
        endMs: null,
        durationMs: null,
        startsAtBeginning: true,
        endsAtMediaEnd: true,
      }
    );
  });
});
