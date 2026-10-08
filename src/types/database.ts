// Database row types — matches Supabase schema

export type StreamProvider = "anivexa" | "tatakai" | "external";

export type StreamLanguage =
  | "sub"
  | "dub"
  | "raw"
  | "hindi"
  | "tamil"
  | "telugu"
  | "bengali";

export type StreamQuality = "auto" | "1080p" | "720p" | "480p" | "360p";

export type StreamFormat = "hls" | "dash" | "mp4" | "embed";

export type StreamStatus =
  | "active"
  | "degraded"
  | "offline"
  | "maintenance";

// Row shape for INSERT into streams table
export interface StreamInsert {
  episode_id: string;
  provider: StreamProvider;
  url: string;
  language: StreamLanguage;
  quality: StreamQuality;
  format: StreamFormat;
  status: StreamStatus;
  health_score: number;
  fail_count: number;
  is_primary: boolean;
  server_name: string | null;
  source_slug: string | null;
  link_expires_at: string | null;
}

// Existing stream row (for idempotency check)
export interface StreamRow {
  id: string;
  episode_id: string;
  provider: StreamProvider;
  url: string;
  language: StreamLanguage;
  server_name: string | null;
  source_slug: string | null;
  status: StreamStatus;
  deleted_at: string | null;
}

// Episode lookup result
export interface EpisodeRow {
  id: string;
  episode_number: number;
}

// Anime metadata from DB
export interface AnimeRow {
  id: string;
  slug: string;
  title: string;
  english_title: string | null;
  romaji_title: string | null;
  anilist_id: number | null;
  mal_id: number | null;
  is_movie: boolean;
  episodes_count: number | null;
}
