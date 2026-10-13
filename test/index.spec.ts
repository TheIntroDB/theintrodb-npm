import {
  buildMediaQuery,
  createIntroDbClient,
  getMedia,
  mapSubmission,
  normalizeEpisodeOrder,
  normalizeSegmentTimestamp,
  parseMediaResponse,
  serializeMapRequest,
  serializeSubmissionRequest,
  submitMediaTimestamp,
  type TheIntroDbApiError,
  TheIntroDbResponseValidationError,
  TheIntroDbValidationError,
} from '../src';
import type {
  FetchLike,
  FetchResponseLike,
  HeadersLike,
  TIDBLogger,
} from '../src/types';

const V4_BASE = 'https://api.theintrodb.org/v4';

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

const MOVIE_MEDIA_BODY = {
  tvdb_id: 169,
  type: 'movie',
  intro: [{ start_ms: null, end_ms: 90000 }],
  credits: [
    { start_ms: 0, end_ms: 90000 },
    { start_ms: 1800000, end_ms: null },
  ],
};

const SUBMISSION_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('TheIntroDB package', () => {
  describe('baseUrl handling', () => {
    it('defaults to the v4 production endpoint', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await getMedia({ tvdbId: 169 }, { fetch: fetchMock });

      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=169`,
        expect.any(Object)
      );
    });

    it('converts http to https in baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await getMedia(
        { tvdbId: 169 },
        { fetch: fetchMock, baseUrl: 'http://api.theintrodb.org/v4' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=169`,
        expect.any(Object)
      );
    });

    it('prepends https if no protocol is given in baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await getMedia(
        { tvdbId: 169 },
        { fetch: fetchMock, baseUrl: 'api.theintrodb.org/v4' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=169`,
        expect.any(Object)
      );
    });

    it('strips trailing slashes from baseUrl', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await getMedia(
        { tvdbId: 169 },
        { fetch: fetchMock, baseUrl: 'https://api.theintrodb.org/v4/' }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=169`,
        expect.any(Object)
      );
    });
  });

  describe('episode orders', () => {
    it('canonicalises TVDB names and Jellyfin aliases', () => {
      expect(normalizeEpisodeOrder('default')).toBe('default');
      expect(normalizeEpisodeOrder('Aired-Order')).toBe('official');
      expect(normalizeEpisodeOrder('altdvd')).toBe('dvd');
      expect(normalizeEpisodeOrder('alt_two')).toBe('alternate');
      expect(normalizeEpisodeOrder('Streaming')).toBe('alternate');
      expect(normalizeEpisodeOrder('productionorder')).toBe('regional');
      expect(normalizeEpisodeOrder('bogus')).toBeUndefined();
    });

    it('ignores inherited object properties', () => {
      expect(normalizeEpisodeOrder('constructor')).toBeUndefined();
      expect(normalizeEpisodeOrder('__proto__')).toBeUndefined();
      expect(normalizeEpisodeOrder('hasOwnProperty')).toBeUndefined();
      expect(normalizeEpisodeOrder('toString')).toBeUndefined();
    });

    it('rejects an inherited property name as a mapping', () => {
      expect(() =>
        serializeSubmissionRequest({
          tvdbId: 169,
          type: 'tv',
          segment: 'intro',
          season: 1,
          episode: 1,
          mapping: 'constructor',
          startSec: 0,
          endSec: 90,
        })
      ).toThrow(TheIntroDbValidationError);
    });
  });

  describe('getMedia', () => {
    it('normalizes null timestamps from media responses', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      const result = await getMedia({ tvdbId: 169 }, { fetch: fetchMock });

      expect(result.kind).toBe('media');
      if (result.kind !== 'media') throw new Error('unreachable');

      expect(result.tvdbId).toBe(169);
      expect(result.groupDurationMs).toBeNull();
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
        `${V4_BASE}/media?tvdb_id=169`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        })
      );
    });

    it('carries detail fields when the API returns them', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tvdb_id: 71663,
            type: 'tv',
            season: 1,
            episode: 1,
            group_duration_ms: 1400000,
            intro: [
              {
                start_ms: null,
                end_ms: 23000,
                confidence: 0.87,
                submission_count: 12,
              },
            ],
          },
        })
      );

      const result = await getMedia(
        { tvdbId: 71663, season: 1, episode: 1, details: true },
        { fetch: fetchMock }
      );

      if (result.kind !== 'media') throw new Error('unreachable');

      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
      expect(result.groupDurationMs).toBe(1400000);
      expect(result.intro[0].confidence).toBe(0.87);
      expect(result.intro[0].submissionCount).toBe(12);
      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=71663&season=1&episode=1&details=true`,
        expect.any(Object)
      );
    });

    it('builds a query with mapping, hints and duration', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await getMedia(
        {
          tvdbId: 71663,
          season: 1,
          episode: 2,
          mapping: 'altdvd',
          tvdbEpisodeId: 55452,
          episodeName: 'Simpsons Roasting on an Open Fire',
          durationMs: 7200000,
        },
        { fetch: fetchMock }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=71663&season=1&episode=2&mapping=dvd&tvdb_episode_id=55452&episode_name=Simpsons+Roasting+on+an+Open+Fire&duration_ms=7200000`,
        expect.any(Object)
      );
    });

    it('parses a list_versions response into a versions result', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tvdb_id: 169,
            type: 'movie',
            versions: [
              {
                duration_ms: 7200000,
                average_duration_ms: 7195000,
                submission_count: 14,
              },
              { duration_ms: 7560000, submission_count: 3 },
            ],
          },
        })
      );

      const result = await getMedia(
        { tvdbId: 169, listVersions: true },
        { fetch: fetchMock }
      );

      expect(result.kind).toBe('versions');
      if (result.kind !== 'versions') throw new Error('unreachable');

      expect(result.versions).toEqual([
        {
          durationMs: 7200000,
          averageDurationMs: 7195000,
          submissionCount: 14,
        },
        {
          durationMs: 7560000,
          averageDurationMs: null,
          submissionCount: 3,
        },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?tvdb_id=169&list_versions=true`,
        expect.any(Object)
      );
    });

    it('parses the episode-list fallback shape', () => {
      const result = parseMediaResponse({
        tvdb_id: 71663,
        type: 'tv',
        episodes: [
          {
            season: 1,
            episode: 1,
            total_submission_count: 4,
            total_accepted_count: 4,
            total_pending_count: 0,
            total_rejected_count: 0,
            flag_votes: 0,
            intro_accepted_count: 4,
            intro_pending_count: 0,
            intro_rejected_count: 0,
            recap_accepted_count: 0,
            recap_pending_count: 0,
            recap_rejected_count: 0,
            credits_accepted_count: 0,
            credits_pending_count: 0,
            credits_rejected_count: 0,
            preview_accepted_count: 0,
            preview_pending_count: 0,
            preview_rejected_count: 0,
          },
        ],
      });

      expect(result.kind).toBe('episodes');
      if (result.kind !== 'episodes') throw new Error('unreachable');

      expect(result.episodes[0].introAcceptedCount).toBe(4);
      expect(result.episodes[0].totalSubmissionCount).toBe(4);
    });

    it('allows getMedia to use a current user API key for pending submissions', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tvdb_id: 67890,
            type: 'tv',
            season: 1,
            episode: 2,
            preview: [{ start_ms: 1680000, end_ms: null }],
          },
        })
      );
      const logger = createLogger();
      const client = createIntroDbClient({ fetch: fetchMock, logger });

      const result = await client.getMedia(
        { imdbId: 'tt0111161', season: 1, episode: 2 },
        { apiKey: 'user-api-key' }
      );

      if (result.kind !== 'media') throw new Error('unreachable');

      expect(result.preview[0].endMs).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/media?imdb_id=tt0111161&season=1&episode=2`,
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

    it('rejects a request with no media identity', async () => {
      await expect(getMedia({})).rejects.toBeInstanceOf(
        TheIntroDbValidationError
      );

      await expect(getMedia({ tvdbId: 169, season: 1 })).rejects.toBeInstanceOf(
        TheIntroDbValidationError
      );
    });

    it('rejects an unknown mapping before sending the request', async () => {
      const fetchMock = createFetchMock(
        createResponse({ body: MOVIE_MEDIA_BODY })
      );

      await expect(
        getMedia(
          { tvdbId: 169, mapping: 'not-a-real-order' },
          { fetch: fetchMock }
        )
      ).rejects.toBeInstanceOf(TheIntroDbValidationError);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('buildMediaQuery', () => {
    it('omits unspecified parameters and canonicalises the order', () => {
      const query = buildMediaQuery({
        tvdbId: 71663,
        season: 1,
        episode: 1,
        mapping: 'streaming',
      });

      expect(query.toString()).toBe(
        'tvdb_id=71663&season=1&episode=1&mapping=alternate'
      );
    });

    it('forwards more than one identity for the API to prioritise', () => {
      // The API accepts several ids and resolves them in the priority order
      // tvdb_id -> tmdb_id -> imdb_id, so the package forwards all of them
      // rather than rejecting the request.
      expect(buildMediaQuery({ tvdbId: 169, tmdbId: 278 }).toString()).toBe(
        'tvdb_id=169&tmdb_id=278'
      );

      expect(
        serializeSubmissionRequest({
          tvdbId: 169,
          tmdbId: 278,
          type: 'movie',
          segment: 'intro',
          startSec: 0,
          endSec: 90,
        })
      ).toMatchObject({ tvdb_id: 169, tmdb_id: 278 });
    });

    it('sends merge_unknown only when explicitly set', () => {
      expect(buildMediaQuery({ tvdbId: 169 }).toString()).toBe('tvdb_id=169');
      expect(
        buildMediaQuery({ tvdbId: 169, mergeUnknown: false }).toString()
      ).toBe('tvdb_id=169&merge_unknown=false');
    });
  });

  describe('submitMediaTimestamp', () => {
    it('serializes intro null starts and credits null ends', () => {
      expect(
        serializeSubmissionRequest({
          tvdbId: 169,
          type: 'movie',
          segment: 'intro',
          startSec: 0,
          endSec: 90,
        })
      ).toEqual({
        type: 'movie',
        segment: 'intro',
        tvdb_id: 169,
        tmdb_id: undefined,
        imdb_id: undefined,
        season: undefined,
        episode: undefined,
        mapping: undefined,
        tvdb_episode_id: undefined,
        episode_name: undefined,
        episode_title: undefined,
        video_duration_ms: undefined,
        start_ms: null,
        end_ms: 90000,
      });

      expect(
        serializeSubmissionRequest({
          tvdbId: 169,
          type: 'movie',
          segment: 'credits',
          startMs: 1800000,
          endMs: null,
        })
      ).toMatchObject({
        start_ms: 1800000,
        end_ms: null,
      });
    });

    it('canonicalises the mapping and keeps list selections', () => {
      const payload = serializeSubmissionRequest({
        tvdbId: 71663,
        type: 'tv',
        season: '1',
        episode: '1-3',
        mapping: 'alttwo',
        segment: 'recap',
        startSec: 25,
        endSec: 134,
      });

      expect(payload.mapping).toBe('alternate');
      expect(payload.season).toBe('1');
      expect(payload.episode).toBe('1-3');
      expect(payload.start_ms).toBe(25000);
      expect(payload.end_ms).toBe(134000);
    });

    it('submits timestamps, converts seconds to milliseconds, and normalizes the response', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            ok: true,
            submissions: [
              {
                id: SUBMISSION_ID,
                tvdbId: 71663,
                type: 'tv',
                segment: 'intro',
                season: 1,
                episode: 1,
                videoDurationMs: 7200000,
                startMs: null,
                endMs: 85200,
                status: 'pending',
                weight: 1,
              },
            ],
          },
        })
      );
      const logger = createLogger();

      const result = await submitMediaTimestamp(
        {
          tvdbId: 71663,
          type: 'tv',
          segment: 'intro',
          season: 1,
          episode: 1,
          videoDurationMs: 7200000,
          startSec: null,
          endSec: 85.2,
        },
        { apiKey: 'user-api-key', fetch: fetchMock, logger }
      );

      expect(result.ok).toBe(true);
      expect(result.submissions[0].tvdbId).toBe(71663);
      expect(result.submissions[0].startMs).toBe(0);
      expect(result.submissions[0].startsAtBeginning).toBe(true);
      expect(fetchMock.mock.calls[0][1]?.body).toBe(
        JSON.stringify({
          type: 'tv',
          segment: 'intro',
          tvdb_id: 71663,
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
            tvdbId: 169,
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

    it('rejects movie submissions that carry episode numbering', () => {
      expect(() =>
        serializeSubmissionRequest({
          tvdbId: 169,
          type: 'movie',
          segment: 'intro',
          mapping: 'dvd',
          startSec: 0,
          endSec: 90,
        })
      ).toThrow(TheIntroDbValidationError);
    });
  });

  describe('mapSubmission', () => {
    it('serializes a map request without timestamps', () => {
      expect(
        serializeMapRequest({
          tvdbId: 71663,
          type: 'tv',
          mapping: 'dvd',
          season: '1',
          episode: '1',
        })
      ).toEqual({
        type: 'tv',
        tvdb_id: 71663,
        tmdb_id: undefined,
        imdb_id: undefined,
        season: '1',
        episode: '1',
        mapping: 'dvd',
        tvdb_episode_id: undefined,
        episode_name: undefined,
        episode_title: undefined,
      });
    });

    it('resolves a mapping over /map with the current user API key', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          body: {
            tvdb_id: 71663,
            type: 'tv',
            mapping: 'dvd',
            media_title: 'The Simpsons',
            season: 1,
            episode: 1,
            tvdb_episode_id: 55452,
            episode_title: 'Simpsons Roasting on an Open Fire',
          },
        })
      );

      const result = await mapSubmission(
        {
          tvdbId: 71663,
          type: 'tv',
          mapping: 'dvd',
          season: '1',
          episode: '1',
        },
        { apiKey: 'user-api-key', fetch: fetchMock }
      );

      expect(result).toEqual({
        tvdbId: 71663,
        type: 'tv',
        mapping: 'dvd',
        mediaTitle: 'The Simpsons',
        season: 1,
        episode: 1,
        tvdbEpisodeId: 55452,
        episodeTitle: 'Simpsons Roasting on an Open Fire',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `${V4_BASE}/map`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer user-api-key',
          }),
        })
      );
    });

    it('requires the current user API key', async () => {
      await expect(
        mapSubmission({
          tvdbId: 71663,
          type: 'tv',
          season: 1,
          episode: 1,
        })
      ).rejects.toThrow("mapSubmission requires the current user's API key");
    });
  });

  describe('errors and validation', () => {
    it('surfaces API failures with rate-limit and specific-media metadata', async () => {
      const fetchMock = createFetchMock(
        createResponse({
          status: 429,
          statusText: 'Too Many Requests',
          body: {
            error: 'Specific media usage limit exceeded',
            code: 'specific_media_usage_limit_exceeded',
            retry_after: '8.4 hours',
          },
          headers: {
            'X-UsageLimit-Limit': '1000',
            'X-UsageLimit-Remaining': '0',
            'X-UsageLimit-Reset': '30240',
            'X-UsageLimit-SpecificMedia-Limit': '2000',
            'X-UsageLimit-SpecificMedia-Remaining': '0',
            'X-UsageLimit-SpecificMedia-Reset': '43200',
          },
        })
      );

      await expect(
        getMedia({ tvdbId: 169 }, { fetch: fetchMock })
      ).rejects.toMatchObject<Partial<TheIntroDbApiError>>({
        name: 'TheIntroDbApiError',
        status: 429,
        code: 'specific_media_usage_limit_exceeded',
        rateLimit: expect.objectContaining({
          usageLimit: 1000,
          usageRemaining: 0,
          usageResetSeconds: 30240,
          specificMediaLimit: 2000,
          specificMediaRemaining: 0,
          specificMediaResetSeconds: 43200,
        }),
      });
    });

    it('rejects malformed response bodies', () => {
      expect(() =>
        parseMediaResponse({
          tvdb_id: 169,
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
        getMedia({ tvdbId: 169 }, { fetch: fetchMock })
      ).rejects.toMatchObject<Partial<TheIntroDbApiError>>({
        name: 'TheIntroDbApiError',
        status: 502,
        message: 'TheIntroDB API request failed with status 502.',
        body: '<html>502 Bad Gateway</html>',
      });
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
