// Environment variables and bindings available in Cloudflare Workers
interface Env {
  // Vars from wrangler.jsonc
  NEON_AUTH_URL: string;
  NEON_DATA_API_URL: string;
  R2_ENDPOINT: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;

  // Secrets (set in Cloudflare dashboard)
  DATABASE_URL: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;

  // Future: R2 binding (if you switch from SDK to native binding)
  // IMAGES: R2Bucket;
}

declare module "h3" {
  interface H3EventContext {
    cf: CfProperties;
    cloudflare: {
      request: Request;
      env: Env;
      context: ExecutionContext;
    };
  }
}

export {};
