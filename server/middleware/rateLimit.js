import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const json = (message) => ({ error: message });

/** Broad safety net for every route, keyed by client IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests. Please slow down.'),
});

/** Login/signup: slows password guessing and account spam. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many attempts. Please try again in a few minutes.'),
});

/** Routes that cost money (LLM calls). Keyed by user once authenticated. */
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.email || ipKeyGenerator(req.ip),
  message: json('You are sending messages too quickly. Please wait a moment.'),
});
