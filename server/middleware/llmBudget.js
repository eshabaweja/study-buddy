// A spending cap for paid LLM calls. Counters live in memory, which is fine for
// a single-instance demo; with several instances you would move them to Redis
// or the database so every instance shares one count.

const DAY_MS = 24 * 60 * 60 * 1000;

export function createLlmBudget({
  perUserPerDay = Number(process.env.LLM_DAILY_LIMIT_PER_USER) || 100,
  globalPerDay = Number(process.env.LLM_DAILY_LIMIT_GLOBAL) || 1000,
  now = () => Date.now(),
} = {}) {
  let windowStart = now();
  let globalCount = 0;
  const perUser = new Map();

  const rollover = () => {
    if (now() - windowStart >= DAY_MS) {
      windowStart = now();
      globalCount = 0;
      perUser.clear();
    }
  };

  return {
    /** Returns { ok: true } and counts the call, or { ok: false, reason }. */
    tryConsume(userKey) {
      rollover();
      if (globalCount >= globalPerDay) return { ok: false, reason: 'global' };
      const used = perUser.get(userKey) || 0;
      if (used >= perUserPerDay) return { ok: false, reason: 'user' };
      perUser.set(userKey, used + 1);
      globalCount += 1;
      return { ok: true };
    },
  };
}

const budget = createLlmBudget();

/** For non-HTTP call sites (batch jobs): returns { ok } and counts the call. */
export const tryConsumeLlmBudget = (userKey) => budget.tryConsume(userKey);

/** Express middleware; requires req.user (run an auth middleware first). */
export function enforceLlmBudget(req, res, next) {
  const result = budget.tryConsume(req.user?.email || req.ip);
  if (result.ok) return next();
  const message =
    result.reason === 'global'
      ? 'The demo has reached its daily AI usage limit. Please try again tomorrow.'
      : 'You have reached your daily AI usage limit. Please try again tomorrow.';
  return res.status(429).json({ error: message });
}
