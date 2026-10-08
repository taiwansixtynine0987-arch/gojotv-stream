// Provider configuration and rules learned from testing

// Blacklisted servers (dead or unusable)
export const BLACKLISTED_SERVERS = new Set([
  "Streamp2pdub",  // dead
  "Vidgroud",      // ads blocked, unusable
  "Vidstream-1",   // usually inactive
  "Vidstream-2",   // usually inactive
  "HD-2",          // usually inactive
]);

// Anivexa server mapping
export const ANIVEXA_PROVIDERS = [
  { provider: "anikoto", serverName: "Anikoto", priority: 1 },
  { provider: "animegg", serverName: "Animegg", priority: 2 },
] as const;

// Tatakai animehindidubbed server mapping
export const HINDI_DUBBED_PROVIDERS = [
  { key: "filemoon", serverName: "Filemoon", priority: 1, multiAudio: true },
  { key: "servabyss", serverName: "Servabyss", priority: 2, multiAudio: false },
] as const;

// Tatakai desidubanime server mapping
export const DESI_DUB_PROVIDERS = [
  { key: "Mirrordub", serverName: "Mirror", priority: 1 },
  { key: "Abyssdub", serverName: "Abyss", priority: 2 },
  { key: "VMolydub", serverName: "VMoly", priority: 3 },
] as const;

// Timeouts
export const API_TIMEOUT_MS = 25000;
export const CONCURRENCY_LIMIT = 5;
export const MAX_RETRIES = 2;

// Language codes matching streams.language enum
export const LANG = {
  SUB: "sub",
  DUB: "dub",
  HINDI: "hindi",
} as const;

// Provider codes matching streams.provider enum
export const PROV = {
  ANIVEXA: "anivexa",
  TATAKAI: "tatakai",
} as const;
