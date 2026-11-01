# Concepts Log

A running glossary of engineering ideas used in Study Buddy. Each entry is a plain definition plus where it shows up in this repo. Add new entries as you learn them.

Format: **Term**: what it is. *In this repo:* where to see it.

## Contents

1. [Security](#1-security)
2. [Protecting your wallet and your server](#2-protecting-your-wallet-and-your-server)
3. [Running and shipping software](#3-running-and-shipping-software)
4. [Databases](#4-databases)
5. [Testing and CI](#5-testing-and-ci)
6. [Web delivery](#6-web-delivery)
7. [Working with AI models](#7-working-with-ai-models)
8. [Observability and operations](#8-observability-and-operations)
9. [Front-end and licensing](#9-front-end-and-licensing)
10. [Books](#books)

---

## 1. Security

**Authentication vs authorization**: Authentication asks "who are you?" (logging in). Authorization asks "what are you allowed to do?" (a student cannot create a course). They fail in different ways, so test both.
*In this repo:* `server/middleware/auth.js` (roles), `server/db/courseOwnership.js` (ownership checks).

**Password hashing (argon2)**: Store a slow, salted one-way hash of the password, never the password. If the database leaks, attackers still cannot read passwords quickly.
*In this repo:* `server/routes/auth.js`.

**JWT (JSON Web Token)**: A signed token the server hands out at login and the browser sends back on each request. The signature proves the server issued it. Anyone who has the secret can forge tokens, so the secret must be long and private.
*In this repo:* `server/routes/auth.js`, `JWT_SECRET` in `server/config/env.js`.

**Input validation (schema validation)**: Check the shape and size of every incoming request against a declared schema before using it. Reject early, with a clear 400 error.
*In this repo:* `server/middleware/validate.js` (zod).

**Mass assignment**: When a server copies fields from the request into a database row without checking, a client can set fields it should not (like `is_instructor: true`). Fix it by allow-listing fields.
*In this repo:* a test checks that signup ignores an `is_instructor` flag.

**Prompt injection**: Untrusted text that tries to change an AI model's instructions ("ignore your rules"). Never let the client choose the model's system or developer messages.
*In this repo:* `tutorSchema` only accepts `user` and `assistant` turns.

**Security headers (helmet)**: Response headers that tell the browser to behave more safely, such as refusing to guess file types or to be framed by other sites.
*In this repo:* `server/app.js`.

**CSP (Content-Security-Policy)**: A header listing exactly where scripts, styles, images and connections may come from. If an attacker injects a script tag, the browser refuses to run it. It is the main defense against XSS.
*In this repo:* the `contentSecurityPolicy` block in `server/app.js`. It once blocked the client from calling the wrong API URL, which is how you know it works.

**XSS (cross-site scripting)**: Injecting a script into a page other people view, for example through rich text. Defenses: sanitize HTML, set a CSP.
*In this repo:* the client sanitizes rich text with DOMPurify; the CSP is a second layer.

**CORS (cross-origin resource sharing)**: Browsers block a page from reading responses from a different origin (scheme, host, port) unless the server allows it. CORS is a browser rule, not server security: it does not stop curl or other servers.
*In this repo:* `ALLOWED_ORIGINS` and `cors()` in `server/app.js`.

**Generic errors**: Return "Internal server error" to clients and log the details privately. Error text can reveal file paths, SQL, or provider keys.
*In this repo:* the error handler at the bottom of `server/app.js`.

**Secrets and environment variables**: Keys and passwords live in the environment (or a secrets manager), never in git. Config that changes per environment is injected from outside the code.
*In this repo:* `.env` files are git-ignored; `docker-compose.yml` shows local-only values clearly labelled.

**Fail fast**: Check configuration at startup and refuse to run if it is wrong. A crash at boot is easier to debug than a strange error an hour later.
*In this repo:* `validateEnv()` in `server/config/env.js`.

**Synthetic data**: Fake data that looks real enough to demo with. Never put real student data in a public demo.
*In this repo:* `server/scripts/seedDemo.js` (accounts use the reserved `.invalid` domain, which can never be a real address).

## 2. Protecting your wallet and your server

**Rate limiting**: Cap how many requests one client can make in a time window, and answer extra requests with 429 "Too many requests". It slows password guessing, stops spam, and protects paid APIs.
*In this repo:* `server/middleware/rateLimit.js`.

**Rate-limit key**: What you count by. IP address works before login; user ID works after login, so shared school Wi-Fi does not punish everyone at once.
*In this repo:* `llmLimiter` keys by user email, falling back to IP.

**IPv6 gotcha**: One person can own a huge range of IPv6 addresses, so limiting by the raw address is easy to dodge. Libraries provide a helper that groups an address range together.
*In this repo:* `ipKeyGenerator` in `rateLimit.js`.

**Budget (spend cap)**: A hard daily limit on paid calls, per user and in total. Rate limits control speed; a budget controls total cost.
*In this repo:* `server/middleware/llmBudget.js`.

**In-memory state vs shared state**: Counters kept in one process's memory vanish on restart and are not shared across multiple servers. For several instances, move them to Redis or the database.
*In this repo:* the budget and rate limits are in memory, noted in the README.

**Payload size limit**: Refuse huge request bodies so one request cannot exhaust memory. The server answers 413 "Payload too large".
*In this repo:* `JSON_BODY_LIMIT`, the `entity.too.large` handler.

**Denial of service (DoS)**: Making a service unusable by overloading it. Rate limits, size limits and timeouts are the basic defenses.

## 3. Running and shipping software

**Container**: A packaged process with its own filesystem and dependencies, so it runs the same on any machine. Lighter than a virtual machine because it shares the host's kernel.

**Docker image**: The read-only recipe-result a container starts from. A **Dockerfile** is the recipe.
*In this repo:* `Dockerfile`.

**Multi-stage build**: Use one stage to build (compilers, dev tools) and copy only the results into a small final image. Smaller images are faster to deploy and expose less.
*In this repo:* the Dockerfile builds the client in one stage and the server's native module in another.

**`.dockerignore`**: Files kept out of the image, like `node_modules`, `.env` and local dumps. It prevents secrets from being baked into an image.
*In this repo:* `.dockerignore`.

**Docker Compose**: One file that starts several containers together (app plus database) with their networking.
*In this repo:* `docker-compose.yml`.

**Volume**: Storage that outlives a container. Without one, the database or uploads disappear when the container is replaced.
*In this repo:* `pgdata` and `uploads` in `docker-compose.yml`.

**Ephemeral disk**: On many hosts, files written inside a container vanish on redeploy. Use object storage (like S3) for user uploads in real production.

**Non-root user**: Run the app as an unprivileged user so a compromised process can do less damage.
*In this repo:* `USER node` in the Dockerfile.

**Reverse proxy and `trust proxy`**: Hosting platforms put a proxy in front of your app, so every request appears to come from the proxy. The real client IP is in the `X-Forwarded-For` header; `trust proxy` tells Express to use it. Without it, rate limiting treats everyone as one user.
*In this repo:* `app.set('trust proxy', 1)`.

**Single-origin deployment**: Serve the API and the web app from the same host. It avoids CORS entirely and simplifies cookies. The API goes under `/api` so it cannot clash with page routes.
*In this repo:* `SERVE_CLIENT` in `server/app.js`.

**SPA fallback**: A single-page app has one real HTML file; the server must return it for any unknown path (like `/quizzes/5`) so the browser-side router can take over on refresh.
*In this repo:* the catch-all route in `server/app.js`.

**Infrastructure as code (Blueprint)**: Describe servers and databases in a file that lives in git, instead of clicking in a dashboard. Repeatable and reviewable.
*In this repo:* `render.yaml`.

**Cold start**: Free hosting often sleeps idle apps, so the first request after a pause is slow.

## 4. Databases

**Schema migration**: A numbered, versioned change to the database structure, applied in order. The database records which ones ran, so each runs exactly once.
*In this repo:* `server/db/migrations/`, `server/scripts/setupDb.js`, the `schema_migrations` table.

**Idempotent**: Safe to run twice with the same end result. Your seed script and `db:setup` are idempotent; the old migrations were not, which is why re-running them failed.

**Transaction**: A group of database changes that all succeed or all roll back. Each migration and the seed run inside one.

**Seeding**: Loading starter data so a fresh database is usable.
*In this repo:* `npm run db:seed`.

**Connection pool**: A reusable set of database connections shared by requests, because opening one per request is slow.
*In this repo:* `server/db/database.js`.

**Foreign key and unique constraint**: Rules the database enforces itself (a course must have a real instructor; two users cannot share an email). Constraints catch bugs that application code misses.

**Ownership check**: Filtering queries by the logged-in owner (`WHERE instructor_email = $1`) so one user cannot touch another's rows. A common source of real-world breaches when forgotten.
*In this repo:* `server/db/courseOwnership.js`.

## 5. Testing and CI

**Unit test**: Tests one small function in isolation, fast.
*In this repo:* `server/tests/units.test.js`.

**Integration test**: Tests several real pieces together (HTTP, app code, a real database). Slower, but it catches the bugs that matter.
*In this repo:* `server/tests/api.test.js`.

**Test setup and teardown**: Create the data a test needs, then remove it so tests do not affect each other.

**Mocking**: Replacing a real dependency (like the AI provider) with a fake. Useful, but over-mocking hides real failures. Here the tests simply remove the LLM key so nothing can call out.

**CI (continuous integration)**: A server that runs your build and tests automatically on every push, so broken code is noticed immediately.
*In this repo:* `.github/workflows/ci.yml`.

**Service container**: A helper container (here Postgres) that CI starts next to your job so tests can use a real database.

**Test-driven proof**: A test that fails when the bug exists is evidence the fix works. The authorization tests prove one instructor cannot publish another's course.

## 6. Web delivery

**CDN (content delivery network)**: A worldwide network of servers that cache copies of your static files (images, scripts, fonts) near each visitor, so pages load faster and your server does less work. Typical setup: put a CDN (Cloudflare, CloudFront) in front of your site; it fetches files from your server once, then serves them from the nearest location.
*In this repo:* not set up yet. The app loads fonts from Google's CDN, and a jQuery CDN script was removed because nothing used it. Every third-party CDN is a dependency, a privacy trade-off, and an entry in your CSP.

**Caching and cache headers**: Telling browsers and CDNs how long a file stays valid (`Cache-Control`). Hashed file names (like `index-AbC123.js`) can be cached for a year because a change creates a new name.
*In this repo:* `maxAge: '1h'` on static files in `server/app.js`.

**Static vs dynamic content**: Static files are the same for everyone and ideal for a CDN. Dynamic responses (your courses, your grades) depend on the user and are not cached publicly.

**Build step (bundling)**: Turning source code into optimized files for browsers. Vite produces the `dist/` folder.

**TLS/HTTPS**: Encryption between browser and server. Hosting platforms usually handle certificates for you.

## 7. Working with AI models

**LLM provider and OpenAI-compatible API**: Many providers accept the same request format, so you can swap them by changing a base URL and key.
*In this repo:* `server/config/llm.js`.

**Streaming**: Sending the model's answer in small pieces as it is generated, so the user sees text appear immediately instead of waiting.
*In this repo:* the server-sent events loop in `server/routes/openai-api.js`.

**Grounding**: Telling the model to answer only from supplied material, which reduces made-up facts.
*In this repo:* "Use ONLY the provided context" in the tutor prompt.

**RAG (retrieval-augmented generation)**: Searching a document store for relevant text and adding it to the prompt. Not used here, because each question's context is passed directly.

**Evaluation harness (evals)**: A set of fixed test conversations plus a scoring method, used to compare prompts and models with numbers rather than hunches.
*In this repo:* planned next.

**LLM-as-judge**: Using a second model to score a first model's answers against a rubric (for example, "did it leak the solution?"). Useful but must itself be spot-checked by a human.

**Token**: The unit providers bill by (roughly three-quarters of a word). Longer prompts and histories cost more, which is why messages are length-capped.

## 8. Observability and operations

**Health check**: A URL that reports whether the app works. A *liveness* check says the process is up; a *readiness* check also verifies dependencies such as the database. Hosts use it to restart or stop routing to a sick instance.
*In this repo:* `/api/health`, and the Docker `HEALTHCHECK`.

**Observability**: Being able to understand a running system from the outside, through logs (events), metrics (numbers over time) and traces (one request's path).

**Instrumentation**: The code you add to produce those logs and metrics, for example recording each AI call's latency and token count.

**Orchestration**: Coordinating multi-step work so it runs in order and recovers from failure. In infrastructure, Kubernetes orchestrates containers. In AI apps, it means the code around model calls (retries, sequencing).

**Queue (background jobs)**: Put slow work on a list that a worker processes separately, so web requests return quickly. A candidate for batch AI grading.

**Graceful degradation**: When a dependency fails, keep the rest working. The tutor returns 503 "not configured" instead of crashing the server.

**Technical debt**: Known shortcuts you will need to pay back later. Example here: about 170 existing lint errors that are excluded from CI for now.

## 9. Front-end and licensing

**SVG icons and CSS masks**: SVG is a text-based image format that scales perfectly. Using an SVG as a CSS `mask` lets it take the current text color, so one file works in light and dark themes.
*In this repo:* the `--sb-icon-*` variables in `client/src/styles/ui.css`.

**CSS custom properties (variables)**: Named values like `--sb-icon-check` reused across a stylesheet.

**Class-name prefixing**: Starting every class with a short prefix (`sb-`, `app-`) avoids clashes with other libraries and shows where a style comes from.

**Software licenses (MIT, ISC, Apache 2.0, OFL)**: Terms for reusing someone's code or assets. MIT and ISC mostly ask you to keep the copyright notice. Always check before copying anything, and credit it.
*In this repo:* Lucide icons (ISC) and Google Fonts (OFL) are listed in the README.

**Dependency**: Code you rely on but did not write. Each one adds update work and security risk, so drop the ones you do not use (the AWS packages and jQuery were removed).

---

## Books

You do not need to read these cover to cover. Read the chapters that match what you built, so you can explain it in an interview.

| Book | Best for | Honest coverage note |
|------|----------|----------------------|
| *Designing Data-Intensive Applications*, Martin Kleppmann | Databases, transactions, caching, queues, why shared state matters | The classic backend book. Dense; read selected chapters. It does not teach Docker or CI. |
| *API Security in Action*, Neil Madden | Rate limiting, JWT, CORS, authentication vs authorization, input validation, security headers | The most directly relevant book for the hardening you just did. Examples are Java but the ideas transfer. |
| *Docker Deep Dive*, Nigel Poulton | Images, containers, multi-stage builds, volumes, Compose | Short and practical. Start here for the Docker section. |
| *System Design Interview*, Alex Xu (Vol. 1) | Rate limiter design, CDN, caching, scaling | Good for interview preparation. It has a rate limiter chapter and covers CDNs and caching at overview level. |
| *Release It!*, Michael Nygard | Timeouts, retries, circuit breakers, graceful degradation | The origin of many reliability patterns, helpful once you add queues and retries. |
| *AI Engineering*, Chip Huyen | Evals, LLM-as-judge, prompt injection, cost control | Directly supports your planned eval harness and budget design. |
| *Continuous Delivery*, Jez Humble and David Farley | CI, deployment pipelines, why small frequent releases | Older but the principles still hold. |

Free resources that cover much of the same ground:

- **OWASP Top 10** and the **OWASP Cheat Sheet Series** (owasp.org): the standard reference for the security items above.
- **MDN Web Docs**: CORS, CSP, caching headers and HTTP, all clearly explained.
- ***Software Engineering at Google*** (abseil.io/resources/swe-book, free online): testing and CI chapters.
- ***Site Reliability Engineering*** (sre.google/books, free online): monitoring, health, and operations.
- ***High Performance Browser Networking***, Ilya Grigorik (hpbn.co, free online): HTTP, TLS, and how content gets to browsers.

If you only read one: *API Security in Action* for what this project did, then *Designing Data-Intensive Applications* for the data and scaling ideas behind it. I could not check every chapter of these books from here, so skim the table of contents before buying.
