/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions */
import { z } from 'zod';
import type {
  EpisodeOrder,
  EpisodeOrderInput,
  EpisodeSelection,
  FetchLike,
  GetMediaParams,
  HeadersLike,
  MapResponseRaw,
  MapResult,
  MapSubmissionInput,
  MediaEpisodeList,
  MediaEpisodeListRaw,
  MediaEpisodeSummary,
  MediaEpisodeSummaryRaw,
  MediaRecord,
  MediaResponse,
  MediaResponseRaw,
  MediaVersion,
  MediaVersionRaw,
  MediaVersions,
  MediaVersionsRaw,
  NormalizedSegmentTimestamp,
  RateLimitDetails,
  SegmentTimestampRaw,
  SegmentType,
  SubmissionData,
  SubmissionDataRaw,
  SubmissionRequestPayload,
  SubmissionResponse,
  SubmissionResponseRaw,
  SubmitMediaTimestampInput,
  TIDBClient,
  TIDBClientOptions,
  TIDBRequestOptions,
  TIDBTransportOptions,
} from './types';
import {
  EPISODE_ORDER_ALIASES,
  EPISODE_ORDERS,
  MEDIA_TYPES,
  SEGMENT_TYPES,
  SUBMISSION_STATUSES,
} from './types';

const DEFAULT_BASE_URL = 'https://api.theintrodb.org/v4';
const MAX_TVDB_ID = 100_000_000;
const MAX_TMDB_ID = 10_000_000;
const MAX_SEASON = 1000;
const MAX_EPISODE = 10_000;
const MAX_TIMESTAMP_SECONDS = 21_600;
const MAX_TIMESTAMP_MS = 21_600_000;
const MIN_VIDEO_DURATION_MS = 300_000;
const IMDB_ID_PATTERN = /^tt[0-9]{7,8}$/;
// A single number, a comma-separated list, an ascending range, or a mix:
// "1", "1,2", "1-3", "1,3-4,6". Season 0 (specials) is valid.
const EPISODE_SELECTION_PATTERN =
  /^\s*\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*\s*$/;

const mediaTypeSchema = z.enum(MEDIA_TYPES);
const segmentTypeSchema = z.enum(SEGMENT_TYPES);
const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
const episodeSelectionSchema = z.union([
  z.number().int().min(0),
  z.string().regex(EPISODE_SELECTION_PATTERN),
]);

const segmentTimestampRawSchema = z.object({
  start_ms: z.number().int().min(0).nullable(),
  end_ms: z.number().int().min(0).nullable(),
  confidence: z.number().nullable().optional(),
  submission_count: z.number().int().nullable().optional(),
});

const mediaResponseRawSchema = z.object({
  tvdb_id: z.number().int().min(1).max(MAX_TVDB_ID),
  type: mediaTypeSchema,
  season: z.number().int().min(0).nullable().optional(),
  episode: z.number().int().min(0).nullable().optional(),
  group_duration_ms: z.number().int().nullable().optional(),
  intro: z.array(segmentTimestampRawSchema).optional(),
  recap: z.array(segmentTimestampRawSchema).optional(),
  credits: z.array(segmentTimestampRawSchema).optional(),
  preview: z.array(segmentTimestampRawSchema).optional(),
});

const mediaVersionRawSchema = z.object({
  duration_ms: z.number().int().min(0),
  average_duration_ms: z.number().int().nullable().optional(),
  submission_count: z.number().int().min(0),
});

const mediaVersionsRawSchema = z.object({
  tvdb_id: z.number().int().min(1).max(MAX_TVDB_ID),
  type: mediaTypeSchema,
  season: z.number().int().min(0).nullable().optional(),
  episode: z.number().int().min(0).nullable().optional(),
  versions: z.array(mediaVersionRawSchema),
});

const mediaEpisodeSummaryRawSchema = z.object({
  season: z.number().int().min(0),
  episode: z.number().int().min(0),
  total_submission_count: z.number().int().min(0),
  total_accepted_count: z.number().int().min(0),
  total_pending_count: z.number().int().min(0),
  total_rejected_count: z.number().int().min(0),
  flag_votes: z.number().int().min(0),
  intro_accepted_count: z.number().int().min(0),
  intro_pending_count: z.number().int().min(0),
  intro_rejected_count: z.number().int().min(0),
  recap_accepted_count: z.number().int().min(0),
  recap_pending_count: z.number().int().min(0),
  recap_rejected_count: z.number().int().min(0),
  credits_accepted_count: z.number().int().min(0),
  credits_pending_count: z.number().int().min(0),
  credits_rejected_count: z.number().int().min(0),
  preview_accepted_count: z.number().int().min(0),
  preview_pending_count: z.number().int().min(0),
  preview_rejected_count: z.number().int().min(0),
});

const mediaEpisodeListRawSchema = z.object({
  tvdb_id: z.number().int().min(1).max(MAX_TVDB_ID),
  type: mediaTypeSchema,
  episodes: z.array(mediaEpisodeSummaryRawSchema).optional(),
});

const submissionDataRawSchema = z.object({
  id: z.string().uuid(),
  tvdbId: z.number().int().min(1).max(MAX_TVDB_ID).nullable(),
  type: mediaTypeSchema,
  segment: segmentTypeSchema,
  season: z.number().int().min(0).nullable().optional(),
  episode: z.number().int().min(0).nullable().optional(),
  videoDurationMs: z.number().int().min(0).max(MAX_TIMESTAMP_MS).nullable(),
  startMs: z.number().int().min(0).nullable().optional(),
  endMs: z.number().int().min(0).nullable().optional(),
  status: submissionStatusSchema,
  weight: z.number().min(0),
});

const submissionResponseRawSchema = z.object({
  ok: z.boolean(),
  submissions: z.array(submissionDataRawSchema),
});

const mapResponseRawSchema = z.object({
  tvdb_id: z.number().int().min(1).max(MAX_TVDB_ID),
  type: mediaTypeSchema,
  mapping: z.string(),
  media_title: z.string().optional(),
  season: z.number().int().min(0).nullable().optional(),
  episode: z.number().int().min(0).nullable().optional(),
  tvdb_episode_id: z.number().int().nullable().optional(),
  episode_title: z.string().optional(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
  retry_after: z.string().optional(),
});

/**
 * Resolves a `mapping` spelling to its canonical TVDB episode order.
 *
 * Case, spaces, dashes and underscores are ignored, so TVDB's own names and the
 * Jellyfin `displayorder` vocabulary are both accepted. Returns `undefined` for
 * an unrecognised spelling.
 */
export function normalizeEpisodeOrder(name: string): EpisodeOrder | undefined {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  return EPISODE_ORDER_ALIASES[key] ?? undefined;
}

function validateEpisodeOrder(
  value: EpisodeOrderInput,
  ctx: z.RefinementCtx,
  path: string
): void {
  if (normalizeEpisodeOrder(value) == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unknown episode order \`${value}\`. Use one of ${EPISODE_ORDERS.join(
        ', '
      )}, or an accepted alias (e.g. \`aired\`, \`altdvd\`, \`alttwo\`, \`streaming\`).`,
      path: [path],
    });
  }
}

function hasNoMediaIdentity(value: {
  tvdbId?: number;
  tmdbId?: number;
  imdbId?: string;
}): boolean {
  return value.tvdbId == null && value.tmdbId == null && value.imdbId == null;
}

function isSingleCoordinate(value: EpisodeSelection | undefined): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return true;
  return !/[,-]/.test(value);
}

const getMediaParamsSchema = z
  .object({
    tvdbId: z.number().int().min(1).max(MAX_TVDB_ID).optional(),
    tmdbId: z.number().int().min(1).max(MAX_TMDB_ID).optional(),
    imdbId: z.string().regex(IMDB_ID_PATTERN).optional(),
    season: z.number().int().min(0).max(MAX_SEASON).optional(),
    episode: z.number().int().min(0).max(MAX_EPISODE).optional(),
    mapping: z.string().optional(),
    tvdbEpisodeId: z.number().int().min(1).optional(),
    episodeName: z.string().optional(),
    episodeTitle: z.string().optional(),
    durationMs: z.number().int().min(0).max(MAX_TIMESTAMP_MS).optional(),
    listVersions: z.boolean().optional(),
    mergeUnknown: z.boolean().optional(),
    details: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (hasNoMediaIdentity(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide one of `tvdbId`, `tmdbId`, or `imdbId`.',
        path: ['tvdbId'],
      });
    }

    const hasSeason = value.season != null;
    const hasEpisode = value.episode != null;

    if (hasSeason !== hasEpisode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`season` and `episode` must be provided together.',
        path: hasSeason ? ['episode'] : ['season'],
      });
    }

    if (value.mapping !== undefined) {
      validateEpisodeOrder(value.mapping, ctx, 'mapping');
    }
  });

const submitMediaInputSchema = z
  .object({
    tvdbId: z.number().int().min(1).max(MAX_TVDB_ID).optional(),
    tmdbId: z.number().int().min(1).max(MAX_TMDB_ID).optional(),
    imdbId: z.string().regex(IMDB_ID_PATTERN).optional(),
    type: mediaTypeSchema,
    segment: segmentTypeSchema,
    season: episodeSelectionSchema.optional(),
    episode: episodeSelectionSchema.optional(),
    mapping: z.string().optional(),
    tvdbEpisodeId: z.number().int().min(1).optional(),
    episodeName: z.string().optional(),
    episodeTitle: z.string().optional(),
    videoDurationMs: z
      .number()
      .int()
      .min(0)
      .max(MAX_TIMESTAMP_MS)
      .nullable()
      .optional(),
    startSec: z
      .number()
      .min(0)
      .max(MAX_TIMESTAMP_SECONDS)
      .nullable()
      .optional(),
    endSec: z.number().min(0).max(MAX_TIMESTAMP_SECONDS).nullable().optional(),
    startMs: z
      .number()
      .int()
      .min(0)
      .max(MAX_TIMESTAMP_MS)
      .nullable()
      .optional(),
    endMs: z.number().int().min(0).max(MAX_TIMESTAMP_MS).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (hasNoMediaIdentity(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide one of `tvdbId`, `tmdbId`, or `imdbId` as the media identifier.',
        path: ['tvdbId'],
      });
    }

    if (value.type === 'tv') {
      if (value.season == null || value.episode == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`season` and `episode` are required when `type` is `tv`.',
          path: ['season'],
        });
      }
      if (
        value.videoDurationMs != null &&
        (!isSingleCoordinate(value.season) ||
          !isSingleCoordinate(value.episode))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            '`videoDurationMs` is only supported for single TV episodes (season/episode must be single values, not lists or ranges).',
          path: ['videoDurationMs'],
        });
      }
    } else {
      if (value.season != null || value.episode != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            '`season` and `episode` must be omitted when `type` is `movie`.',
          path: ['season'],
        });
      }
      if (value.mapping != null && value.mapping !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`mapping` must be omitted when `type` is `movie`.',
          path: ['mapping'],
        });
      }
      if (value.tvdbEpisodeId != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`tvdbEpisodeId` must be omitted when `type` is `movie`.',
          path: ['tvdbEpisodeId'],
        });
      }
    }

    if (value.mapping != null && value.mapping !== '') {
      validateEpisodeOrder(value.mapping, ctx, 'mapping');
    }

    if (
      value.videoDurationMs != null &&
      value.videoDurationMs !== 0 &&
      value.videoDurationMs < MIN_VIDEO_DURATION_MS
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `\`videoDurationMs\` must be 0 (unknown) or at least ${MIN_VIDEO_DURATION_MS}ms.`,
        path: ['videoDurationMs'],
      });
    }

    const usesSeconds =
      value.startSec !== undefined || value.endSec !== undefined;
    const usesMilliseconds =
      value.startMs !== undefined || value.endMs !== undefined;

    if (!usesSeconds && !usesMilliseconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either `startSec`/`endSec` or `startMs`/`endMs`.',
        path: ['startMs'],
      });
      return;
    }

    if (usesSeconds && usesMilliseconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use either seconds or milliseconds, not both.',
        path: ['startSec'],
      });
      return;
    }

    const startMs = usesSeconds
      ? toMilliseconds(value.startSec)
      : (value.startMs ?? undefined);
    const endMs = usesSeconds
      ? toMilliseconds(value.endSec)
      : (value.endMs ?? undefined);

    validateSubmissionTiming(value.segment, startMs, endMs, ctx);
  });

const mapSubmissionInputSchema = z
  .object({
    tvdbId: z.number().int().min(1).max(MAX_TVDB_ID).optional(),
    tmdbId: z.number().int().min(1).max(MAX_TMDB_ID).optional(),
    imdbId: z.string().regex(IMDB_ID_PATTERN).optional(),
    type: mediaTypeSchema,
    season: episodeSelectionSchema.optional(),
    episode: episodeSelectionSchema.optional(),
    mapping: z.string().optional(),
    tvdbEpisodeId: z.number().int().min(1).optional(),
    episodeName: z.string().optional(),
    episodeTitle: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (hasNoMediaIdentity(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide one of `tvdbId`, `tmdbId`, or `imdbId` as the media identifier.',
        path: ['tvdbId'],
      });
    }

    if (value.type === 'tv') {
      if (value.season == null || value.episode == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`season` and `episode` are required when `type` is `tv`.',
          path: ['season'],
        });
      }
    } else {
      if (value.season != null || value.episode != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            '`season` and `episode` must be omitted when `type` is `movie`.',
          path: ['season'],
        });
      }
      if (value.mapping != null && value.mapping !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`mapping` must be omitted when `type` is `movie`.',
          path: ['mapping'],
        });
      }
      if (value.tvdbEpisodeId != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`tvdbEpisodeId` must be omitted when `type` is `movie`.',
          path: ['tvdbEpisodeId'],
        });
      }
    }

    if (value.mapping != null && value.mapping !== '') {
      validateEpisodeOrder(value.mapping, ctx, 'mapping');
    }
  });

type OperationName = 'getMedia' | 'submitMediaTimestamp' | 'mapSubmission';

interface JsonRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: URLSearchParams;
  body?: unknown;
  authRequired?: boolean;
  operationName: OperationName;
}

interface PreparedTransport {
  baseUrl: string;
  apiKey?: string;
  headers: Record<string, string>;
  fetch?: FetchLike;
  logger?: TIDBTransportOptions['logger'];
  signal?: unknown;
}

export class TheIntroDbValidationError extends Error {
  public readonly issues: string[];

  public constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'TheIntroDbValidationError';
    this.issues = issues;
  }
}

export class TheIntroDbResponseValidationError extends TheIntroDbValidationError {
  public readonly body: unknown;
  public readonly status?: number;

  public constructor(
    message: string,
    body: unknown,
    issues: string[],
    status?: number
  ) {
    super(message, issues);
    this.name = 'TheIntroDbResponseValidationError';
    this.body = body;
    this.status = status;
  }
}

export class TheIntroDbApiError extends Error {
  public readonly status: number;
  public readonly details?: string;
  public readonly code?: string;
  public readonly body: unknown;
  public readonly rateLimit: RateLimitDetails;

  public constructor(
    message: string,
    status: number,
    body: unknown,
    rateLimit: RateLimitDetails,
    details?: string,
    code?: string
  ) {
    super(message);
    this.name = 'TheIntroDbApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.body = body;
    this.rateLimit = rateLimit;
  }
}

export function createIntroDbClient(
  options: TIDBClientOptions = {}
): TIDBClient {
  return {
    getMedia: (params, requestOptions) =>
      getMedia(params, mergeTransportOptions(options, requestOptions)),
    mapSubmission: (input, requestOptions) =>
      mapSubmission(input, mergeTransportOptions(options, requestOptions)),
    submitMediaTimestamp: (input, requestOptions) =>
      submitMediaTimestamp(
        input,
        mergeTransportOptions(options, requestOptions)
      ),
  };
}

export async function getMedia(
  params: GetMediaParams,
  transportOptions: TIDBTransportOptions = {}
): Promise<MediaResponse> {
  const parsedParams = parseWithSchema(
    getMediaParamsSchema,
    params,
    'Invalid `getMedia` parameters.'
  );
  const transport = resolveTransport(transportOptions);
  const query = buildMediaQuery(parsedParams, true);
  const body = await requestJson(
    { method: 'GET', path: '/media', query, operationName: 'getMedia' },
    transport
  );
  return parseMediaResponse(body);
}

export async function submitMediaTimestamp(
  input: SubmitMediaTimestampInput,
  transportOptions: TIDBTransportOptions = {}
): Promise<SubmissionResponse> {
  const payload = serializeSubmissionRequest(input);
  const transport = resolveTransport(transportOptions);
  const body = await requestJson(
    {
      method: 'POST',
      path: '/submit',
      body: payload,
      authRequired: true,
      operationName: 'submitMediaTimestamp',
    },
    transport
  );
  return parseSubmissionResponse(body);
}

export async function mapSubmission(
  input: MapSubmissionInput,
  transportOptions: TIDBTransportOptions = {}
): Promise<MapResult> {
  const payload = serializeMapRequest(input);
  const transport = resolveTransport(transportOptions);
  const body = await requestJson(
    {
      method: 'POST',
      path: '/map',
      body: payload,
      authRequired: true,
      operationName: 'mapSubmission',
    },
    transport
  );
  return parseMapResponse(body);
}

export function buildMediaQuery(
  params: GetMediaParams,
  skipValidation = false
): URLSearchParams {
  const parsedParams = skipValidation
    ? params
    : parseWithSchema(
        getMediaParamsSchema,
        params,
        'Invalid `getMedia` parameters.'
      );
  const query = new URLSearchParams();

  if (parsedParams.tvdbId != null) {
    query.set('tvdb_id', String(parsedParams.tvdbId));
  }

  if (parsedParams.tmdbId != null) {
    query.set('tmdb_id', String(parsedParams.tmdbId));
  }

  if (parsedParams.imdbId != null) {
    query.set('imdb_id', parsedParams.imdbId);
  }

  if (parsedParams.season != null) {
    query.set('season', String(parsedParams.season));
  }

  if (parsedParams.episode != null) {
    query.set('episode', String(parsedParams.episode));
  }

  if (parsedParams.mapping != null) {
    const order = normalizeEpisodeOrder(parsedParams.mapping);
    if (order != null) {
      query.set('mapping', order);
    }
  }

  if (parsedParams.tvdbEpisodeId != null) {
    query.set('tvdb_episode_id', String(parsedParams.tvdbEpisodeId));
  }

  if (parsedParams.episodeName != null) {
    query.set('episode_name', parsedParams.episodeName);
  }

  if (parsedParams.episodeTitle != null) {
    query.set('episode_title', parsedParams.episodeTitle);
  }

  if (parsedParams.durationMs != null) {
    query.set('duration_ms', String(parsedParams.durationMs));
  }

  if (parsedParams.listVersions) {
    query.set('list_versions', 'true');
  }

  if (parsedParams.mergeUnknown != null) {
    query.set('merge_unknown', String(parsedParams.mergeUnknown));
  }

  if (parsedParams.details) {
    query.set('details', 'true');
  }

  return query;
}

export function serializeSubmissionRequest(
  input: SubmitMediaTimestampInput
): SubmissionRequestPayload {
  const parsedInput = parseWithSchema(
    submitMediaInputSchema,
    input,
    'Invalid `submitMediaTimestamp` payload.'
  );

  const usesSeconds =
    parsedInput.startSec !== undefined || parsedInput.endSec !== undefined;
  const startMs = usesSeconds
    ? toMilliseconds(parsedInput.startSec)
    : (parsedInput.startMs ?? undefined);
  const endMs = usesSeconds
    ? toMilliseconds(parsedInput.endSec)
    : (parsedInput.endMs ?? undefined);

  return {
    type: parsedInput.type,
    segment: parsedInput.segment,
    ...serializeIdentity(parsedInput),
    season: parsedInput.season,
    episode: parsedInput.episode,
    mapping:
      parsedInput.mapping != null && parsedInput.mapping !== ''
        ? normalizeEpisodeOrder(parsedInput.mapping)
        : undefined,
    tvdb_episode_id: parsedInput.tvdbEpisodeId,
    episode_name: parsedInput.episodeName,
    episode_title: parsedInput.episodeTitle,
    video_duration_ms: parsedInput.videoDurationMs ?? undefined,
    start_ms: normalizeRequestStart(parsedInput.segment, startMs),
    end_ms: normalizeRequestEnd(parsedInput.segment, endMs),
  };
}

export function serializeMapRequest(
  input: MapSubmissionInput
): Record<string, unknown> {
  const parsedInput = parseWithSchema(
    mapSubmissionInputSchema,
    input,
    'Invalid `mapSubmission` payload.'
  );

  return {
    type: parsedInput.type,
    ...serializeIdentity(parsedInput),
    season: parsedInput.season,
    episode: parsedInput.episode,
    mapping:
      parsedInput.mapping != null && parsedInput.mapping !== ''
        ? normalizeEpisodeOrder(parsedInput.mapping)
        : undefined,
    tvdb_episode_id: parsedInput.tvdbEpisodeId,
    episode_name: parsedInput.episodeName,
    episode_title: parsedInput.episodeTitle,
  };
}

export function parseMediaResponse(body: unknown): MediaResponse {
  const record = isRecord(body) ? body : undefined;

  if (record != null && Array.isArray(record.versions)) {
    return parseMediaVersions(record);
  }

  if (record != null && Array.isArray(record.episodes)) {
    return parseMediaEpisodes(record);
  }

  return parseMediaRecord(body);
}

export function parseMediaRecord(body: unknown): MediaRecord {
  const parsed = safeParseWithSchema<MediaResponseRaw>(
    mediaResponseRawSchema,
    body,
    'Invalid `/media` response payload.'
  );

  return {
    kind: 'media',
    tvdbId: parsed.tvdb_id,
    type: parsed.type,
    season: parsed.season ?? undefined,
    episode: parsed.episode ?? undefined,
    groupDurationMs: parsed.group_duration_ms ?? null,
    intro: normalizeSegmentCollection(parsed.intro),
    recap: normalizeSegmentCollection(parsed.recap),
    credits: normalizeSegmentCollection(parsed.credits),
    preview: normalizeSegmentCollection(parsed.preview),
  };
}

export function parseMediaVersions(body: unknown): MediaVersions {
  const parsed = safeParseWithSchema<MediaVersionsRaw>(
    mediaVersionsRawSchema,
    body,
    'Invalid `/media` versions response payload.'
  );

  return {
    kind: 'versions',
    tvdbId: parsed.tvdb_id,
    type: parsed.type,
    season: parsed.season ?? undefined,
    episode: parsed.episode ?? undefined,
    versions: parsed.versions.map(normalizeMediaVersion),
  };
}

export function parseMediaEpisodes(body: unknown): MediaEpisodeList {
  const parsed = safeParseWithSchema<MediaEpisodeListRaw>(
    mediaEpisodeListRawSchema,
    body,
    'Invalid `/media` episode-list response payload.'
  );

  return {
    kind: 'episodes',
    tvdbId: parsed.tvdb_id,
    type: parsed.type,
    episodes: (parsed.episodes ?? []).map(normalizeMediaEpisodeSummary),
  };
}

export function parseSubmissionResponse(body: unknown): SubmissionResponse {
  const parsed = safeParseWithSchema<SubmissionResponseRaw>(
    submissionResponseRawSchema,
    body,
    'Invalid `/submit` response payload.'
  );

  return {
    ok: parsed.ok,
    submissions: parsed.submissions.map(normalizeSubmissionData),
  };
}

export function parseMapResponse(body: unknown): MapResult {
  const parsed = safeParseWithSchema<MapResponseRaw>(
    mapResponseRawSchema,
    body,
    'Invalid `/map` response payload.'
  );

  const result: MapResult = {
    tvdbId: parsed.tvdb_id,
    type: parsed.type,
    mapping: parsed.mapping,
  };

  if (parsed.media_title != null) {
    result.mediaTitle = parsed.media_title;
  }

  if (parsed.season != null) {
    result.season = parsed.season;
  }

  if (parsed.episode != null) {
    result.episode = parsed.episode;
  }

  if (parsed.tvdb_episode_id != null) {
    result.tvdbEpisodeId = parsed.tvdb_episode_id;
  }

  if (parsed.episode_title != null) {
    result.episodeTitle = parsed.episode_title;
  }

  return result;
}

export function normalizeSegmentTimestamp(
  timestamp: SegmentTimestampRaw
): NormalizedSegmentTimestamp {
  const startMs = timestamp.start_ms ?? 0;
  const endMs = timestamp.end_ms ?? null;

  const normalized: NormalizedSegmentTimestamp = {
    startMs,
    endMs,
    durationMs: endMs == null ? null : Math.max(endMs - startMs, 0),
    startsAtBeginning: timestamp.start_ms == null,
    endsAtMediaEnd: timestamp.end_ms == null,
  };

  if ('confidence' in timestamp) {
    normalized.confidence = timestamp.confidence ?? null;
  }

  if ('submission_count' in timestamp) {
    normalized.submissionCount = timestamp.submission_count ?? null;
  }

  return normalized;
}

function serializeIdentity(input: {
  tvdbId?: number;
  tmdbId?: number;
  imdbId?: string;
}): { tvdb_id?: number; tmdb_id?: number; imdb_id?: string } {
  return {
    tvdb_id: input.tvdbId,
    tmdb_id: input.tmdbId,
    imdb_id: input.imdbId,
  };
}

function normalizeMediaVersion(version: MediaVersionRaw): MediaVersion {
  return {
    durationMs: version.duration_ms,
    averageDurationMs: version.average_duration_ms ?? null,
    submissionCount: version.submission_count,
  };
}

function normalizeMediaEpisodeSummary(
  summary: MediaEpisodeSummaryRaw
): MediaEpisodeSummary {
  return {
    season: summary.season,
    episode: summary.episode,
    totalSubmissionCount: summary.total_submission_count,
    totalAcceptedCount: summary.total_accepted_count,
    totalPendingCount: summary.total_pending_count,
    totalRejectedCount: summary.total_rejected_count,
    flagVotes: summary.flag_votes,
    introAcceptedCount: summary.intro_accepted_count,
    introPendingCount: summary.intro_pending_count,
    introRejectedCount: summary.intro_rejected_count,
    recapAcceptedCount: summary.recap_accepted_count,
    recapPendingCount: summary.recap_pending_count,
    recapRejectedCount: summary.recap_rejected_count,
    creditsAcceptedCount: summary.credits_accepted_count,
    creditsPendingCount: summary.credits_pending_count,
    creditsRejectedCount: summary.credits_rejected_count,
    previewAcceptedCount: summary.preview_accepted_count,
    previewPendingCount: summary.preview_pending_count,
    previewRejectedCount: summary.preview_rejected_count,
  };
}

function normalizeSegmentCollection(
  timestamps: SegmentTimestampRaw[] | undefined
): NormalizedSegmentTimestamp[] {
  if (!timestamps) return [];
  return timestamps.map(normalizeSegmentTimestamp);
}

function normalizeSubmissionData(
  submission: SubmissionDataRaw
): SubmissionData {
  const startMs = submission.startMs ?? 0;
  const endMs = submission.endMs ?? null;

  return {
    id: submission.id,
    tvdbId: submission.tvdbId ?? null,
    type: submission.type,
    segment: submission.segment,
    season: submission.season ?? undefined,
    episode: submission.episode ?? undefined,
    videoDurationMs: submission.videoDurationMs ?? null,
    startMs,
    endMs,
    durationMs: endMs == null ? null : Math.max(endMs - startMs, 0),
    startsAtBeginning: submission.startMs == null,
    endsAtMediaEnd: submission.endMs == null,
    status: submission.status,
    weight: submission.weight,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveTransport(
  transportOptions: TIDBTransportOptions
): PreparedTransport {
  return {
    baseUrl: sanitizeBaseUrl(transportOptions.baseUrl ?? DEFAULT_BASE_URL),
    apiKey: transportOptions.apiKey,
    headers: transportOptions.headers ? { ...transportOptions.headers } : {},
    fetch: transportOptions.fetch,
    logger: transportOptions.logger,
    signal: transportOptions.signal,
  };
}

function mergeTransportOptions(
  clientOptions: TIDBClientOptions,
  requestOptions?: TIDBRequestOptions
): TIDBTransportOptions {
  return {
    baseUrl: clientOptions.baseUrl,
    apiKey: requestOptions?.apiKey ?? clientOptions.apiKey,
    headers: {
      ...(clientOptions.headers ?? {}),
      ...(requestOptions?.headers ?? {}),
    },
    fetch: clientOptions.fetch,
    logger: requestOptions?.logger ?? clientOptions.logger,
    signal: requestOptions?.signal,
  };
}

async function requestJson(
  options: JsonRequestOptions,
  transport: PreparedTransport
): Promise<unknown> {
  const url = new URL(`${transport.baseUrl}${options.path}`);

  if (options.query != null) {
    url.search = options.query.toString();
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...transport.headers,
  };

  if (options.body != null) {
    headers['Content-Type'] = 'application/json';
  }

  const apiKey = transport.apiKey?.trim();

  if (options.operationName === 'getMedia' && apiKey) {
    writeLog(
      transport,
      'info',
      "Using a current user API key for getMedia; the response may include that user's pending submissions.",
      {
        path: options.path,
      }
    );
  }

  if (options.authRequired && !apiKey) {
    writeLog(
      transport,
      'error',
      `${options.operationName} requires the current user's API key so the request is made on that user account.`,
      { path: options.path }
    );
    throw new TheIntroDbValidationError(
      `${options.operationName} requires the current user's API key. Provide that user key in the client or request options.`
    );
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (options.operationName === 'submitMediaTimestamp') {
    writeLog(
      transport,
      'info',
      "Submitting timestamps with the current user's API key.",
      { path: options.path }
    );
  }

  if (options.operationName === 'mapSubmission') {
    writeLog(
      transport,
      'info',
      "Resolving a submission mapping with the current user's API key.",
      { path: options.path }
    );
  }

  const fetchImplementation = transport.fetch ?? getGlobalFetch();

  const response = await fetchImplementation(url.toString(), {
    method: options.method,
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
    signal: transport.signal,
  });

  const text = await response.text();
  const parsedBody = parseJsonBody(text);
  const rateLimit = readRateLimitHeaders(response.headers);

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(parsedBody);
    const message = parsedError.success
      ? parsedError.data.error
      : `TheIntroDB API request failed with status ${response.status}.`;
    const details = parsedError.success ? parsedError.data.details : undefined;
    const code = parsedError.success ? parsedError.data.code : undefined;

    throw new TheIntroDbApiError(
      message,
      response.status,
      parsedBody,
      rateLimit,
      details,
      code
    );
  }

  if (parsedBody == null) {
    throw new TheIntroDbResponseValidationError(
      'Expected a JSON response body but received an empty response.',
      parsedBody,
      [],
      response.status
    );
  }

  return parsedBody;
}

function writeLog(
  transport: PreparedTransport,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
): void {
  transport.logger?.[level]?.(message, context);
}

function readRateLimitHeaders(headers: HeadersLike): RateLimitDetails {
  return {
    rateLimit: parseNullableInteger(headers.get('X-RateLimit-Limit')),
    rateLimitRemaining: parseNullableInteger(
      headers.get('X-RateLimit-Remaining')
    ),
    rateLimitResetSeconds: parseNullableInteger(
      headers.get('X-RateLimit-Reset')
    ),
    usageLimit: parseNullableInteger(headers.get('X-UsageLimit-Limit')),
    usageRemaining: parseNullableInteger(headers.get('X-UsageLimit-Remaining')),
    usageResetSeconds: parseNullableInteger(headers.get('X-UsageLimit-Reset')),
    specificMediaLimit: parseNullableInteger(
      headers.get('X-UsageLimit-SpecificMedia-Limit')
    ),
    specificMediaRemaining: parseNullableInteger(
      headers.get('X-UsageLimit-SpecificMedia-Remaining')
    ),
    specificMediaResetSeconds: parseNullableInteger(
      headers.get('X-UsageLimit-SpecificMedia-Reset')
    ),
  };
}

function parseNullableInteger(value: string | null): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonBody(bodyText: string): unknown {
  if (bodyText.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

let _globalFetch: FetchLike | undefined;

function getGlobalFetch(): FetchLike {
  if (_globalFetch) return _globalFetch;

  const candidate = (globalThis as { fetch?: unknown }).fetch;

  if (typeof candidate !== 'function') {
    throw new TheIntroDbValidationError(
      'No fetch implementation is available. Provide one in the client options.'
    );
  }

  _globalFetch = candidate as FetchLike;
  return _globalFetch;
}

function sanitizeBaseUrl(baseUrl: string): string {
  let sanitized = baseUrl;

  if (sanitized.startsWith('http://')) {
    sanitized = `https://${sanitized.slice(7)}`;
  } else if (!sanitized.startsWith('https://')) {
    sanitized = `https://${sanitized}`;
  }

  return sanitized.endsWith('/') ? sanitized.slice(0, -1) : sanitized;
}

function toMilliseconds(
  value: number | null | undefined
): number | null | undefined {
  if (value == null) {
    return value;
  }

  return Math.round(value * 1000);
}

function validateSubmissionTiming(
  segment: SegmentType,
  startMs: number | null | undefined,
  endMs: number | null | undefined,
  ctx: z.RefinementCtx
): void {
  if (segment === 'intro' || segment === 'recap') {
    if (endMs == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `\`${segment}\` submissions require an end time.`,
        path: ['endMs'],
      });
    }
  } else {
    if (startMs == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `\`${segment}\` submissions require a start time.`,
        path: ['startMs'],
      });
    }
  }
}

function normalizeRequestStart(
  segment: SegmentType,
  startMs: number | null | undefined
): number | null | undefined {
  if (
    (segment === 'intro' || segment === 'recap') &&
    (startMs == null || startMs === 0)
  ) {
    return null;
  }

  return startMs;
}

function normalizeRequestEnd(
  segment: SegmentType,
  endMs: number | null | undefined
): number | null | undefined {
  if ((segment === 'credits' || segment === 'preview') && endMs == null) {
    return null;
  }

  return endMs;
}

function parseWithSchema<T>(
  schema: z.ZodSchema<T>,
  value: unknown,
  message: string
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new TheIntroDbValidationError(
      message,
      flattenZodIssues(result.error)
    );
  }

  return result.data;
}

function safeParseWithSchema<T>(
  schema: z.ZodSchema<T>,
  value: unknown,
  message: string
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new TheIntroDbResponseValidationError(
      message,
      value,
      flattenZodIssues(result.error)
    );
  }

  return result.data;
}

function flattenZodIssues(error: z.ZodError): string[] {
  const issues = error.issues;
  const length = issues.length;
  const result = new Array<string>(length);

  for (let i = 0; i < length; i++) {
    const issue = issues[i];
    const path = issue.path;
    const pathLen = path.length;

    if (pathLen === 0) {
      result[i] = issue.message;
    } else if (pathLen === 1) {
      result[i] = `${path[0]}: ${issue.message}`;
    } else {
      result[i] = `${path.join('.')}: ${issue.message}`;
    }
  }

  return result;
}
