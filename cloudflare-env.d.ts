declare namespace Cloudflare {
  interface Env {
    QLOO_API_KEY?: string;
    QLOO_API_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
