// Fail fast at startup: a misconfigured server should refuse to boot,
// not fail on the first request.
const REQUIRED = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];

export function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  // A local Postgres often has no password (DB_PASSWORD=), but production must set one.
  const passwordOk = env.NODE_ENV === 'production' ? Boolean(env.DB_PASSWORD) : env.DB_PASSWORD !== undefined;
  if (!passwordOk) missing.push('DB_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (try: openssl rand -hex 32)');
  }
}

/**
 * Browser origins allowed to call the API. Set ALLOWED_ORIGINS (comma-separated) in production.
 * When unset outside production, any localhost port is allowed, because Vite moves to the
 * next free port (5174, 5175...) when 5173 is busy.
 */
export function allowedOrigins(env = process.env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return env.NODE_ENV === 'production' ? [] : [/^http:\/\/localhost:\d+$/];
}

export const isDemoMode = (env = process.env) => env.DEMO_MODE === 'true';
