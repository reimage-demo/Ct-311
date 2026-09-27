import type {
  D1Database,
  R2Bucket,
  DurableObjectNamespace,
  Fetcher,
  ImagesBinding,
} from "@cloudflare/workers-types";
export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  RATE_GATE: DurableObjectNamespace;
  IMAGES: ImagesBinding;
  ASSETS?: Fetcher;
  APP_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  IP_HASH_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  GEOAPIFY_API_KEY: string;
}
