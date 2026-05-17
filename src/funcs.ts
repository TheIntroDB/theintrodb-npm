/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions */
import { z } from 'zod';

import {
  MEDIA_TYPES,
  SEGMENT_TYPES,
  SUBMISSION_STATUSES,
  FetchLike,
  GetMediaParams,
  HeadersLike,
  MediaRecord,
  MediaResponseRaw,
  NormalizedSegmentTimestamp,
  RateLimitDetails,
  SegmentTimestampRaw,
  SegmentType,
  SubmissionData,
  SubmissionDataRaw,
  SubmissionRequestPayload,
  SubmissionResponse,
  SubmissionResponseRaw,
  TIDBClient,
  TIDBClientOptions,
  TIDBRequestOptions,
  TIDBTransportOptions,
  SubmitMediaTimestampInput,
} from './types';

const DEFAULT_BASE_URL = 'https://api.theintrodb.org/v2';
const MAX_TMDB_ID = 10_000_000;
const MAX_TIMESTAMP_SECONDS = 21_600;
const MAX_TIMESTAMP_MS = 21_600_000;
const IMDB_ID_PATTERN = /^tt[0-9]{7,8}$/;
const EPISODE_SELECTION_PATTERN = /^[1-9]\d*(,\s*[1-9]\d*)*$/;

const mediaTypeSchema = z.enum(MEDIA_TYPES);
const segmentTypeSchema = z.enum(SEGMENT_TYPES);
const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);
const episodeSelectionSchema = z.union([
  z.number().int().min(1),
  z.string().regex(EPISODE_SELECTION_PATTERN),
]);

const segmentTimestampRawSchema = z.object({
  start_ms: z.number().int().min(0).nullable(),
  end_ms: z.number().int().min(0).nullable(),
  confidence: z.number().nullable().optional(),
  submission_count: z.number().int().nullable().optional(),
});

const mediaResponseRawSchema = z.object({
  tmdb_id: z.number().int().min(1).max(MAX_TMDB_ID),
  type: mediaTypeSchema,
  season: z.number().int().min(1).nullable().optional(),
  episode: z.number().int().min(1).nullable().optional(),
  intro: z.array(segmentTimestampRawSchema).optional(),
  recap: z.array(segmentTimestampRawSchema).optional(),
  credits: z.array(segmentTimestampRawSchema).optional(),
  preview: z.array(segmentTimestampRawSchema).optional(),
});

const submissionDataRawSchema = z.object({
  id: z.string().uuid(),
  tmdbId: z.number().int().min(1).max(MAX_TMDB_ID),
  type: mediaTypeSchema,
  segment: segmentTypeSchema,
  season: z.number().int().min(1).nullable().optional(),
  episode: z.number().int().min(1).nullable().optional(),
  startMs: z.number().int().min(0).nullable().optional(),
  endMs: z.number().int().min(0).nullable().optional(),
  status: submissionStatusSchema,
  weight: z.number().min(0),
});

const submissionResponseRawSchema = z.object({
  ok: z.literal(true),
  submission: submissionDataRawSchema,
});

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
  retry_after: z.string().optional(),
});

const getMediaParamsSchema = z
  .object({
    tmdbId: z.number().int().min(1).max(MAX_TMDB_ID).optional(),
    imdbId: z.string().regex(IMDB_ID_PATTERN).optional(),
    season: z.number().int().min(1).optional(),
    episode: z.number().int().min(1).optional(),
    details: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.tmdbId == null && value.imdbId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either `tmdbId` or `imdbId`.',
        path: ['tmdbId'],
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
  });

const submitMediaInputSchema = z
  .object({
    tmdbId: z.number().int().min(1).max(MAX_TMDB_ID),
    imdbId: z.string().regex(IMDB_ID_PATTERN).optional(),
    tvdbId: z.number().int().positive().optional(),
    type: mediaTypeSchema,
    segment: segmentTypeSchema,
    season: episodeSelectionSchema.optional(),
    episode: episodeSelectionSchema.optional(),
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
    if (value.type === 'tv') {
      if (value.season == null || value.episode == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`season` and `episode` are required when `type` is `tv`.',
          path: ['season'],
        });
      }
    } else if (value.season != null || value.episode != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '`season` and `episode` must be omitted when `type` is `movie`.',
        path: ['season'],
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
      : value.startMs ?? undefined;
    const endMs = usesSeconds
      ? toMilliseconds(value.endSec)
      : value.endMs ?? undefined;

    validateSubmissionTiming(value.segment, startMs, endMs, ctx);
  });

interface JsonRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: URLSearchParams;
  body?: unknown;
  authRequired?: boolean;
  operationName: 'getMedia' | 'submitMediaTimestamp';
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
): Promise<MediaRecord> {
  const parsedParams = parseWithSchema(
    getMediaParamsSchema,
    params,
    'Invalid `getMedia` parameters.'
  );
  const transport = resolveTransport(transportOptions);
  const query = buildMediaQuery(parsedParams);
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

export function buildMediaQuery(params: GetMediaParams): URLSearchParams {
  const parsedParams = parseWithSchema(
    getMediaParamsSchema,
    params,
    'Invalid `getMedia` parameters.'
  );
  const query = new URLSearchParams();

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

  if (parsedParams.details === true) {
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
    : parsedInput.startMs ?? undefined;
  const endMs = usesSeconds
    ? toMilliseconds(parsedInput.endSec)
    : parsedInput.endMs ?? undefined;

  return {
    tmdb_id: parsedInput.tmdbId,
    imdb_id: parsedInput.imdbId,
    tvdb_id: parsedInput.tvdbId,
    type: parsedInput.type,
    segment: parsedInput.segment,
    season: parsedInput.season,
    episode: parsedInput.episode,
    start_ms: normalizeRequestStart(parsedInput.segment, startMs),
    end_ms: normalizeRequestEnd(parsedInput.segment, endMs),
  };
}

export function parseMediaResponse(body: unknown): MediaRecord {
  const parsed = safeParseWithSchema<MediaResponseRaw>(
    mediaResponseRawSchema,
    body,
    'Invalid `/media` response payload.'
  );

  return {
    tmdbId: parsed.tmdb_id,
    type: parsed.type,
    season: parsed.season ?? undefined,
    episode: parsed.episode ?? undefined,
    intro: normalizeSegmentCollection(parsed.intro),
    recap: normalizeSegmentCollection(parsed.recap),
    credits: normalizeSegmentCollection(parsed.credits),
    preview: normalizeSegmentCollection(parsed.preview),
  };
}

export function parseSubmissionResponse(body: unknown): SubmissionResponse {
  const parsed = safeParseWithSchema<SubmissionResponseRaw>(
    submissionResponseRawSchema,
    body,
    'Invalid `/submit` response payload.'
  );

  return {
    ok: true,
    submission: normalizeSubmissionData(parsed.submission),
  };
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

  if (Object.prototype.hasOwnProperty.call(timestamp, 'confidence')) {
    normalized.confidence = timestamp.confidence ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(timestamp, 'submission_count')) {
    normalized.submissionCount = timestamp.submission_count ?? null;
  }

  return normalized;
}

function normalizeSegmentCollection(
  timestamps: SegmentTimestampRaw[] | undefined
): NormalizedSegmentTimestamp[] {
  return (timestamps ?? []).map(normalizeSegmentTimestamp);
}

function normalizeSubmissionData(
  submission: SubmissionDataRaw
): SubmissionData {
  const startMs = submission.startMs ?? 0;
  const endMs = submission.endMs ?? null;

  return {
    id: submission.id,
    tmdbId: submission.tmdbId,
    type: submission.type,
    segment: submission.segment,
    season: submission.season ?? undefined,
    episode: submission.episode ?? undefined,
    startMs,
    endMs,
    durationMs: endMs == null ? null : Math.max(endMs - startMs, 0),
    startsAtBeginning: submission.startMs == null,
    endsAtMediaEnd: submission.endMs == null,
    status: submission.status,
    weight: submission.weight,
  };
}

function resolveTransport(
  transportOptions: TIDBTransportOptions
): PreparedTransport {
  return {
    baseUrl: sanitizeBaseUrl(transportOptions.baseUrl ?? DEFAULT_BASE_URL),
    apiKey: transportOptions.apiKey,
    headers: { ...(transportOptions.headers ?? {}) },
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
      "submitMediaTimestamp requires the current user's API key so submissions are stored on that user account.",
      { path: options.path }
    );
    throw new TheIntroDbValidationError(
      "submitMediaTimestamp requires the current user's API key. Provide that user key in the client or request options."
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

function getGlobalFetch(): FetchLike {
  const candidate = (globalThis as { fetch?: unknown }).fetch;

  if (typeof candidate !== 'function') {
    throw new TheIntroDbValidationError(
      'No fetch implementation is available. Provide one in the client options.'
    );
  }

  return candidate as FetchLike;
}

function sanitizeBaseUrl(baseUrl: string): string {
  let sanitized = baseUrl;

  if (sanitized.startsWith('http://')) {
    sanitized = sanitized.replace('http://', 'https://');
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
      let pathStr = String(path[0]);
      for (let j = 1; j < pathLen; j++) {
        pathStr += `.${path[j]}`;
      }
      result[i] = `${pathStr}: ${issue.message}`;
    }
  }

  return result;
}
