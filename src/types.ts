/**
 * The media kinds supported by TheIntroDB.
 */
export const MEDIA_TYPES = ['movie', 'tv'] as const;

/**
 * The segment kinds supported by TheIntroDB.
 */
export const SEGMENT_TYPES = ['intro', 'recap', 'credits', 'preview'] as const;

/**
 * Submission states returned by the API.
 */
export const SUBMISSION_STATUSES = ['pending', 'accepted', 'rejected'] as const;

/**
 * The canonical TVDB episode orders accepted as a `mapping`.
 *
 * Every submission is stored in the `default` order. When your `season`/`episode`
 * numbers are expressed in a different order, pass that order and the API
 * converts them into `default` before storing.
 *
 * - `default`: TVDB's recommended order, and what media servers configured
 *   against TVDB use. This is what an omitted `mapping` means.
 * - `official`: the original broadcast (aired) order.
 * - `dvd`: the DVD / home-video order.
 * - `alternate`: an alternate order (reported by media servers as "alternate",
 *   "alttwo" or "streaming").
 * - `absolute`: one continuous episode numbering across every season.
 * - `regional`: the regional / production order.
 */
export const EPISODE_ORDERS = [
  'default',
  'official',
  'dvd',
  'alternate',
  'absolute',
  'regional',
] as const;

/**
 * Every accepted spelling for a `mapping` value, mapped to its canonical
 * `EpisodeOrder`.
 *
 * The API accepts TVDB's own names and the Jellyfin `displayorder` vocabulary,
 * ignoring case, spaces, dashes and underscores. This table mirrors the server's
 * alias set so a caller can pass any of these spellings and the package
 * canonicalises it before sending it.
 */
export const EPISODE_ORDER_ALIASES: Record<string, EpisodeOrder> = {
  default: 'default',
  defaultorder: 'default',
  official: 'official',
  officialorder: 'official',
  aired: 'official',
  airedorder: 'official',
  dvd: 'dvd',
  altdvd: 'dvd',
  dvdorder: 'dvd',
  absolute: 'absolute',
  absoluteorder: 'absolute',
  abso: 'absolute',
  alternate: 'alternate',
  alternateorder: 'alternate',
  alttwo: 'alternate',
  streaming: 'alternate',
  streamingorder: 'alternate',
  regional: 'regional',
  regionalorder: 'regional',
  production: 'regional',
  productionorder: 'regional',
};

/**
 * Canonical media type returned by the API.
 */
export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Canonical segment type accepted by the API.
 */
export type SegmentType = (typeof SEGMENT_TYPES)[number];

/**
 * Review status assigned to a submission.
 */
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Canonical TVDB episode order. See {@link EPISODE_ORDERS}.
 */
export type EpisodeOrder = (typeof EPISODE_ORDERS)[number];

/**
 * A `mapping` value: a canonical order name or any accepted alias.
 */
export type EpisodeOrderInput = EpisodeOrder | string;

/**
 * The API accepts either a single season/episode number or a string expression.
 *
 * String expressions may be a single number (`"1"`), a comma-separated list
 * (`"1,2"`), an ascending range (`"1-3"`), or a mix (`"1,3-4,6"`). A list/range
 * expands into one submission per season × episode pair on `/submit`, and is
 * refused on `/map` (which resolves a single episode).
 */
export type EpisodeSelection = number | string;

/**
 * The shape of a `GET /media` response: grouped skip timestamps, a release
 * version list (`list_versions=true`), or an episode-list fallback.
 */
export const MEDIA_RESPONSE_KINDS = ['media', 'versions', 'episodes'] as const;

/**
 * Discriminant for the three `GET /media` response shapes.
 */
export type MediaResponseKind = (typeof MEDIA_RESPONSE_KINDS)[number];

/**
 * Raw timestamp object exactly as returned by `/media`.
 * `null` values are preserved here and normalized later.
 */
export interface SegmentTimestampRaw {
  /** Start offset in milliseconds. `null` means "starts at the beginning". */
  start_ms: number | null;
  /** End offset in milliseconds. `null` means "continues to end of media". */
  end_ms: number | null;
  /** Confidence of the weighted average. Only present when `details=true`. */
  confidence?: number | null;
  /** Submissions averaged into the segment. Only present when `details=true`. */
  submission_count?: number | null;
}

/**
 * Normalized timestamp shape exposed by this package.
 */
export interface NormalizedSegmentTimestamp {
  /** Normalized start time in milliseconds. `null` start values become `0`. */
  startMs: number;
  /** End time in milliseconds, or `null` when the segment runs to the media end. */
  endMs: number | null;
  /** Duration in milliseconds when both endpoints are known; otherwise `null`. */
  durationMs: number | null;
  /** True when the source timestamp used `null` for the start. */
  startsAtBeginning: boolean;
  /** True when the source timestamp used `null` for the end. */
  endsAtMediaEnd: boolean;
  /** Confidence of the weighted average, when the API returned `details=true`. */
  confidence?: number | null;
  /** Submissions averaged into the segment, when `details=true` was requested. */
  submissionCount?: number | null;
}

/**
 * Raw grouped-timestamps `/media` response (the default `MediaResponse` shape).
 */
export interface MediaResponseRaw {
  /** TVDB identifier for the media item. TVDB is the identity in v4. */
  tvdb_id: number;
  /** The resolved media kind. */
  type: MediaType;
  /** The caller's season number, echoed back. TV only. */
  season?: number | null;
  /** The caller's episode number, echoed back. TV only. */
  episode?: number | null;
  /** Representative duration (median) of the selected release group. */
  group_duration_ms?: number | null;
  /** Intro segments, if any submissions exist for this segment type. */
  intro?: SegmentTimestampRaw[];
  /** Recap segments, if any submissions exist for this segment type. */
  recap?: SegmentTimestampRaw[];
  /** Credits segments, if any submissions exist for this segment type. */
  credits?: SegmentTimestampRaw[];
  /** Preview segments, if any submissions exist for this segment type. */
  preview?: SegmentTimestampRaw[];
}

/**
 * Normalized grouped-timestamps media record (`GET /media`, the default shape).
 */
export interface MediaRecord {
  /** Response shape discriminant. */
  kind: 'media';
  /** TVDB identifier for the media item. */
  tvdbId: number;
  /** Media type for the record. */
  type: MediaType;
  /** Season number for TV lookups. */
  season?: number;
  /** Episode number for TV lookups. */
  episode?: number;
  /** Representative duration of the selected release group, or `null`. */
  groupDurationMs: number | null;
  /** Normalized intro timestamps. */
  intro: NormalizedSegmentTimestamp[];
  /** Normalized recap timestamps. */
  recap: NormalizedSegmentTimestamp[];
  /** Normalized credits timestamps. */
  credits: NormalizedSegmentTimestamp[];
  /** Normalized preview timestamps. */
  preview: NormalizedSegmentTimestamp[];
}

/**
 * Raw release version entry (`MediaVersionsResponse`).
 */
export interface MediaVersionRaw {
  /** Cluster representative duration (median of the submissions in the group). */
  duration_ms: number;
  /** Arithmetic mean of the durations in the cluster. Informational only. */
  average_duration_ms?: number | null;
  /** Number of submissions in the cluster. */
  submission_count: number;
}

/**
 * Normalized release version entry.
 */
export interface MediaVersion {
  /** Cluster representative duration (median of the submissions in the group). */
  durationMs: number;
  /** Arithmetic mean of the durations in the cluster, or `null`. */
  averageDurationMs: number | null;
  /** Number of submissions in the cluster. */
  submissionCount: number;
}

/**
 * Raw release-version list response, returned when `list_versions=true`.
 */
export interface MediaVersionsRaw {
  /** TVDB identifier for the media item. */
  tvdb_id: number;
  /** The resolved media kind. */
  type: MediaType;
  /** The caller's season number, echoed back. TV only. */
  season?: number | null;
  /** The caller's episode number, echoed back. TV only. */
  episode?: number | null;
  /** Every duration cluster the media has accepted submissions for. */
  versions: MediaVersionRaw[];
}

/**
 * Normalized release-version list (`GET /media` with `listVersions: true`).
 */
export interface MediaVersions {
  /** Response shape discriminant. */
  kind: 'versions';
  /** TVDB identifier for the media item. */
  tvdbId: number;
  /** Media type for the record. */
  type: MediaType;
  /** Season number for TV lookups. */
  season?: number;
  /** Episode number for TV lookups. */
  episode?: number;
  /** Every release version the media has submissions for. */
  versions: MediaVersion[];
}

/**
 * Raw per-episode submission counts (the episode-list fallback shape).
 */
export interface MediaEpisodeSummaryRaw {
  season: number;
  episode: number;
  total_submission_count: number;
  total_accepted_count: number;
  total_pending_count: number;
  total_rejected_count: number;
  flag_votes: number;
  intro_accepted_count: number;
  intro_pending_count: number;
  intro_rejected_count: number;
  recap_accepted_count: number;
  recap_pending_count: number;
  recap_rejected_count: number;
  credits_accepted_count: number;
  credits_pending_count: number;
  credits_rejected_count: number;
  preview_accepted_count: number;
  preview_pending_count: number;
  preview_rejected_count: number;
}

/**
 * Normalized per-episode submission counts.
 */
export interface MediaEpisodeSummary {
  season: number;
  episode: number;
  totalSubmissionCount: number;
  totalAcceptedCount: number;
  totalPendingCount: number;
  totalRejectedCount: number;
  flagVotes: number;
  introAcceptedCount: number;
  introPendingCount: number;
  introRejectedCount: number;
  recapAcceptedCount: number;
  recapPendingCount: number;
  recapRejectedCount: number;
  creditsAcceptedCount: number;
  creditsPendingCount: number;
  creditsRejectedCount: number;
  previewAcceptedCount: number;
  previewPendingCount: number;
  previewRejectedCount: number;
}

/**
 * Raw episode-list response, returned only as a fallback when the media has no
 * submissions and no TMDB API key is configured.
 */
export interface MediaEpisodeListRaw {
  /** TVDB identifier for the media item. */
  tvdb_id: number;
  /** The resolved media kind. */
  type: MediaType;
  /** Per-episode submission counts. */
  episodes?: MediaEpisodeSummaryRaw[];
}

/**
 * Normalized episode-list fallback (`GET /media`).
 */
export interface MediaEpisodeList {
  /** Response shape discriminant. */
  kind: 'episodes';
  /** TVDB identifier for the media item. */
  tvdbId: number;
  /** Media type for the record. */
  type: MediaType;
  /** Per-episode submission counts. */
  episodes: MediaEpisodeSummary[];
}

/**
 * Any `GET /media` response. Narrow it with the `kind` discriminant.
 */
export type MediaResponse = MediaRecord | MediaVersions | MediaEpisodeList;

/**
 * Parameters accepted by `getMedia()`.
 *
 * TVDB is the identity in v4, so `tvdbId` is preferred; `tmdbId` and `imdbId`
 * are accepted as alternate ways to address the media and are resolved
 * server-side. Address the media with exactly one of the three.
 */
export interface GetMediaParams {
  /** Preferred canonical identifier for the media item. */
  tvdbId?: number;
  /** Optional TMDB identifier, resolved server-side to the TVDB identity. */
  tmdbId?: number;
  /** Optional IMDB identifier, resolved server-side to the TVDB identity. */
  imdbId?: string;
  /** Season number for TV lookups. `0` addresses specials. */
  season?: number;
  /** Episode number for TV lookups. */
  episode?: number;
  /**
   * The episode order your `season`/`episode` are given in. Omitted means
   * `default`. See {@link EPISODE_ORDERS}.
   */
  mapping?: EpisodeOrderInput;
  /**
   * A TVDB episode id, which pins one exact episode record. It takes priority
   * over `season`/`episode` when supplied.
   */
  tvdbEpisodeId?: number;
  /** Optional episode title hint corroborating the resolved episode. */
  episodeName?: string;
  /** Alias for `episodeName`. `episodeName` wins when both are supplied. */
  episodeTitle?: string;
  /** Total video duration in milliseconds, used to select a release version. */
  durationMs?: number;
  /**
   * Return the media's release versions instead of the grouped skip timestamps.
   * The response is then a {@link MediaVersions}.
   */
  listVersions?: boolean;
  /**
   * Whether submissions with no known video duration join the selected release
   * group. Omitted leaves the API default (`true`) in place.
   */
  mergeUnknown?: boolean;
  /**
   * Include per-segment `confidence`/`submissionCount` and the body's
   * `groupDurationMs`. Omitted or `false` leaves those fields out.
   */
  details?: boolean;
}

/**
 * Common submission fields shared by seconds-based and milliseconds-based inputs.
 */
export interface SubmitMediaBase {
  /** Preferred canonical identifier for the media item (TVDB). */
  tvdbId?: number;
  /** Optional TMDB identifier, resolved server-side to the TVDB identity. */
  tmdbId?: number;
  /** Optional IMDB identifier, resolved server-side to the TVDB identity. */
  imdbId?: string;
  /** Media type for the submission. */
  type: MediaType;
  /** Segment type being submitted. */
  segment: SegmentType;
  /** Season selector for TV submissions. Omit for movies. */
  season?: EpisodeSelection;
  /** Episode selector for TV submissions. Omit for movies. */
  episode?: EpisodeSelection;
  /**
   * The episode order your `season`/`episode` are given in. Omit or omit for a
   * movie. See {@link EPISODE_ORDERS}.
   */
  mapping?: EpisodeOrderInput;
  /** A TVDB episode id pinning one exact episode record. TV only. */
  tvdbEpisodeId?: number;
  /** Optional episode title hint corroborating the resolved episode. */
  episodeName?: string;
  /** Alias for `episodeName`. `episodeName` wins when both are supplied. */
  episodeTitle?: string;
  videoDurationMs?: number | null;
}

/**
 * Submission input that uses seconds with optional decimal precision.
 */
export interface SubmitMediaSecondsInput extends SubmitMediaBase {
  /** Start time in seconds. `null` is allowed for intro/recap to mean the beginning. */
  startSec?: number | null;
  /** End time in seconds. `null` is allowed for credits/preview to mean media end. */
  endSec?: number | null;
  startMs?: never;
  endMs?: never;
}

/**
 * Submission input that uses integer millisecond values.
 */
export interface SubmitMediaMillisecondsInput extends SubmitMediaBase {
  startSec?: never;
  endSec?: never;
  /** Start time in milliseconds. `null` is allowed for intro/recap to mean the beginning. */
  startMs?: number | null;
  /** End time in milliseconds. `null` is allowed for credits/preview to mean media end. */
  endMs?: number | null;
}

/**
 * Union of all accepted submission payload shapes.
 */
export type SubmitMediaTimestampInput =
  | SubmitMediaSecondsInput
  | SubmitMediaMillisecondsInput;

/**
 * Serialized request body sent to `/submit`.
 */
export interface SubmissionRequestPayload {
  /** Media type for the submission. */
  type: MediaType;
  /** Segment type being submitted. */
  segment: SegmentType;
  /** TVDB identifier for the media item (the preferred identity). */
  tvdb_id?: number;
  /** Optional TMDB identifier, resolved server-side. */
  tmdb_id?: number;
  /** Optional IMDB identifier, resolved server-side. */
  imdb_id?: string;
  /** Season selector for TV submissions. */
  season?: EpisodeSelection;
  /** Episode selector for TV submissions. */
  episode?: EpisodeSelection;
  /** Canonical episode order the coordinates are expressed in. */
  mapping?: EpisodeOrder;
  /** TVDB episode id pinning one exact episode record. */
  tvdb_episode_id?: number;
  /** Optional episode title hint. */
  episode_name?: string;
  /** Alias for `episode_name`. */
  episode_title?: string;
  video_duration_ms?: number | null;
  /** Start time in milliseconds, or `null` when the segment starts at the beginning. */
  start_ms?: number | null;
  /** End time in milliseconds, or `null` when the segment runs to media end. */
  end_ms?: number | null;
}

/**
 * Parameters accepted by `mapSubmission()` — a `POST /map` dry run of `/submit`
 * that resolves the media/episode without storing anything.
 */
export interface MapSubmissionInput {
  /** Media type for the resolution. */
  type: MediaType;
  /** Preferred canonical identifier for the media item (TVDB). */
  tvdbId?: number;
  /** Optional TMDB identifier, resolved server-side. */
  tmdbId?: number;
  /** Optional IMDB identifier, resolved server-side. */
  imdbId?: string;
  /** Season selector for TV submissions. Omit for movies. */
  season?: EpisodeSelection;
  /** Episode selector for TV submissions. Omit for movies. */
  episode?: EpisodeSelection;
  /** The episode order your `season`/`episode` are given in. */
  mapping?: EpisodeOrderInput;
  /** A TVDB episode id pinning one exact episode record. TV only. */
  tvdbEpisodeId?: number;
  /** Optional episode title hint corroborating the resolved episode. */
  episodeName?: string;
  /** Alias for `episodeName`. `episodeName` wins when both are supplied. */
  episodeTitle?: string;
}

/**
 * Raw `POST /map` success body.
 */
export interface MapResponseRaw {
  /** The media's resolved TVDB identity. */
  tvdb_id: number;
  /** The resolved media kind. */
  type: MediaType;
  /** The order the caller's own numbers were read in, canonicalised. */
  mapping: string;
  /** The resolved series or movie name. Best-effort. */
  media_title?: string;
  /** Resolved season in TVDB `default` order. Absent for a movie. */
  season?: number | null;
  /** Resolved episode in TVDB `default` order. Absent for a movie. */
  episode?: number | null;
  /** The TVDB episode record the returned coordinates address. */
  tvdb_episode_id?: number | null;
  /** The resolved episode's title on TVDB. Best-effort. */
  episode_title?: string;
}

/**
 * Normalized `POST /map` result.
 */
export interface MapResult {
  /** The media's resolved TVDB identity. */
  tvdbId: number;
  /** Media type for the record. */
  type: MediaType;
  /** The order the caller's own numbers were read in, canonicalised. */
  mapping: string;
  /** The resolved series or movie name, when the API could read one. */
  mediaTitle?: string;
  /** Resolved season in TVDB `default` order. */
  season?: number;
  /** Resolved episode in TVDB `default` order. */
  episode?: number;
  /** The TVDB episode record addressed by the resolved coordinates. */
  tvdbEpisodeId?: number;
  /** The resolved episode's title on TVDB. */
  episodeTitle?: string;
}

/**
 * Raw submission object returned by `/submit`.
 *
 * The identity field is `tvdbId` (camelCase) in v4 and may be `null` only in a
 * response that predates the field.
 */
export interface SubmissionDataRaw {
  /** Submission UUID generated by the service. */
  id: string;
  /** TVDB identifier for the target media. */
  tvdbId: number | null;
  /** Media type for the submission. */
  type: MediaType;
  /** Segment type that was submitted. */
  segment: SegmentType;
  /** Season number for TV submissions, in TVDB `default` order. */
  season?: number | null;
  /** Episode number for TV submissions, in TVDB `default` order. */
  episode?: number | null;
  videoDurationMs?: number | null;
  /** Start time in milliseconds. `null` means start of media for intro/recap. */
  startMs?: number | null;
  /** End time in milliseconds. `null` means end of media for credits/preview. */
  endMs?: number | null;
  /** Moderation status assigned to the submission. */
  status: SubmissionStatus;
  /** Relative weight used by the backend when averaging timestamps. */
  weight: number;
}

/**
 * Normalized submission data returned by this package.
 */
export interface SubmissionData {
  /** Submission UUID generated by the service. */
  id: string;
  /** TVDB identifier for the target media. */
  tvdbId: number | null;
  /** Media type for the submission. */
  type: MediaType;
  /** Segment type that was submitted. */
  segment: SegmentType;
  /** Season number for TV submissions. */
  season?: number;
  /** Episode number for TV submissions. */
  episode?: number;
  videoDurationMs: number | null;
  /** Normalized start time in milliseconds. */
  startMs: number;
  /** End time in milliseconds, or `null` when the segment reaches media end. */
  endMs: number | null;
  /** Duration in milliseconds when both endpoints are known; otherwise `null`. */
  durationMs: number | null;
  /** True when the source timestamp used `null` for the start. */
  startsAtBeginning: boolean;
  /** True when the source timestamp used `null` for the end. */
  endsAtMediaEnd: boolean;
  /** Moderation status assigned by the service. */
  status: SubmissionStatus;
  /** Relative weight applied by the backend. */
  weight: number;
}

/**
 * Raw `/submit` success response.
 */
export interface SubmissionResponseRaw {
  /** Always `true` on a `200`. */
  ok: boolean;
  submissions: SubmissionDataRaw[];
}

/**
 * Normalized `/submit` success response exposed by this package.
 */
export interface SubmissionResponse {
  /** Always `true` on a `200`. */
  ok: boolean;
  submissions: SubmissionData[];
}

/**
 * Standard error shape used by the API.
 */
export interface ErrorResponse {
  /** Human-readable error message. */
  error: string;
  /** Extra validation or server details when provided by the API. */
  details?: string;
  /** Optional machine-readable code for some error types. */
  code?: string;
  /** Human-readable retry guidance returned on some rate-limit responses. */
  retry_after?: string;
}

/**
 * Parsed rate-limit and usage-limit metadata from response headers.
 */
export interface RateLimitDetails {
  /** Max requests allowed in the current rate-limit window. */
  rateLimit: number | null;
  /** Remaining requests in the current rate-limit window. */
  rateLimitRemaining: number | null;
  /** Seconds until the rate-limit window resets. */
  rateLimitResetSeconds: number | null;
  /** Max requests allowed in the current usage window. */
  usageLimit: number | null;
  /** Remaining requests in the current usage window. */
  usageRemaining: number | null;
  /** Seconds until the usage window resets. */
  usageResetSeconds: number | null;
  /** Max requests allowed for the specific media target, when capped. */
  specificMediaLimit: number | null;
  /** Remaining requests for the specific media target. */
  specificMediaRemaining: number | null;
  /** Seconds until the specific-media usage window resets. */
  specificMediaResetSeconds: number | null;
}

/**
 * Minimal header reader interface used by the internal transport wrapper.
 */
export interface HeadersLike {
  /** Returns the header value for the given name, or `null` if absent. */
  get(name: string): string | null;
}

/**
 * Minimal response shape required from the injected fetch implementation.
 */
export interface FetchResponseLike {
  /** True when the HTTP status is in the 2xx range. */
  ok: boolean;
  /** HTTP status code. */
  status: number;
  /** Human-readable HTTP status text. */
  statusText: string;
  /** Header access helper. */
  headers: HeadersLike;
  /** Reads the response body as text. */
  text(): Promise<string>;
}

/**
 * Minimal fetch signature accepted by the client.
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: unknown;
  }
) => Promise<FetchResponseLike>;

/**
 * TIDB logger hook used for request lifecycle messages.
 * Pass `console` directly if you want simple runtime logging.
 */
export interface TIDBLogger {
  /** Verbose diagnostic logging. */
  debug?(message: string, context?: Record<string, unknown>): void;
  /** Informational request lifecycle logging. */
  info?(message: string, context?: Record<string, unknown>): void;
  /** Non-fatal warnings. */
  warn?(message: string, context?: Record<string, unknown>): void;
  /** Errors that are about to be surfaced to the caller. */
  error?(message: string, context?: Record<string, unknown>): void;
}

/**
 * Shared TIDB transport options for standalone calls and client instances.
 */
export interface TIDBTransportOptions {
  /** Override for the API base URL. Defaults to the production v4 endpoint. */
  baseUrl?: string;
  /**
   * The current user's API key.
   * `getMedia()` may use it optionally to include that user's pending submissions.
   * `submitMediaTimestamp()` and `mapSubmission()` require it.
   */
  apiKey?: string;
  /** Additional headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation for Node, tests, or alternate runtimes. */
  fetch?: FetchLike;
  /** Optional logger for auth and request lifecycle messages. */
  logger?: TIDBLogger;
  /** Abort signal forwarded to the underlying fetch implementation. */
  signal?: unknown;
}

/**
 * Default options applied when creating a reusable TIDB client instance.
 */
export type TIDBClientOptions = Omit<TIDBTransportOptions, 'signal'>;

/**
 * Per-request overrides supported by TIDB client methods.
 */
export type TIDBRequestOptions = Partial<
  Pick<TIDBTransportOptions, 'apiKey' | 'headers' | 'logger' | 'signal'>
>;

/**
 * Public TIDB client contract exposed by `createIntroDbClient()`.
 */
export interface TIDBClient {
  /**
   * Fetches media timestamps, release versions, or an episode-list fallback.
   * This endpoint is public, but passing the current user's API key causes the
   * response to include that user's pending submissions in addition to accepted
   * ones.
   */
  getMedia(
    params: GetMediaParams,
    requestOptions?: TIDBRequestOptions
  ): Promise<MediaResponse>;
  /**
   * Resolves a submission to its TVDB mapping without storing it.
   * This is a dry run of `submitMediaTimestamp()` and requires that user's API
   * key, exactly as a real submission would.
   */
  mapSubmission(
    input: MapSubmissionInput,
    requestOptions?: TIDBRequestOptions
  ): Promise<MapResult>;
  /**
   * Submits timestamps on behalf of the current user.
   * The caller must provide that user's API key either on the client or per request.
   */
  submitMediaTimestamp(
    input: SubmitMediaTimestampInput,
    requestOptions?: TIDBRequestOptions
  ): Promise<SubmissionResponse>;
}
