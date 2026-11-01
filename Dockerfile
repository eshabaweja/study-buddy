# syntax=docker/dockerfile:1

# ---- Build the React client ----
FROM node:22-alpine AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# VITE_API_URL is left unset: production builds call the same-origin /api.
RUN npm run build

# ---- Install server dependencies (argon2 compiles a native addon) ----
FROM node:22-alpine AS server-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---- Runtime image ----
FROM node:22-alpine
ENV NODE_ENV=production \
    SERVE_CLIENT=true \
    PORT=3001
WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/ ./
COPY --from=client-build /client/dist ./public
# Run as an unprivileged user; uploads/ is the only directory the app writes to.
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "server.js"]
