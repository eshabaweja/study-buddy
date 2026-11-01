// Starts the real Express app on a random port, backed by a real Postgres database
// (see "Testing" in the README). Run `npm run db:setup && npm run db:seed` first.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123456';
process.env.DB_HOST ||= 'localhost';
process.env.DB_PORT ||= '5432';
process.env.DB_NAME ||= 'study_buddy_test';
process.env.DB_USER ||= process.env.USER || 'postgres';
process.env.DB_PASSWORD ||= 'postgres';
delete process.env.LLM_API_KEY; // tests must never reach a real provider
delete process.env.LLM_BASE_URL;

const { default: app } = await import('../app.js');
const { default: pool } = await import('../db/database.js');

export { pool };

export function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: async () => {
          await new Promise((r) => server.close(r));
          await pool.end();
        },
      });
    });
  });
}

export async function api(base, path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}
