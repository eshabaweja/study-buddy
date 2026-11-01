// Fail fast at startup: a misconfigured server should refuse to boot,
// not fail on the first request.
const REQUIRED = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

export function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (try: openssl rand -hex 32)');
  }
}

/** Comma-separated list of browser origins allowed to call the API. */
export function allowedOrigins(env = process.env) {
  return (env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const isDemoMode = (env = process.env) => env.DEMO_MODE === 'true';
