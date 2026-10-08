// Anivexa API response shapes

export interface AnivexaStream {
  url: string;              // HLS URL (has token)
  embedUrl?: string;        // iframe embed URL (what we want!)
  type: string;             // "hls" | "embed" | "mp4"
  server: string;           // "HD-1" | "Vidstream-2" etc
  referer?: string;
  priority?: number;
  isActive?: boolean;
  subtitles?: AnivexaSubtitle[];
}

export interface AnivexaSubtitle {
  url: string;
  label: string;
  srclang: string;
  default: boolean;
  source: string;
}

export interface AnivexaWatchResponse {
  anilistId?: number;
  malId?: number;
  episode?: number;
  audio?: string;           // "sub" | "dub"
  streams: AnivexaStream[];
  subtitles?: AnivexaSubtitle[];
  error?: string;
}

// Providers we support on Anivexa
export type AnivexaProvider = "anikoto" | "animegg";
