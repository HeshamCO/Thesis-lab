# syntax=docker/dockerfile:1

# ── deps ──────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun --bun run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Runtime deps only (bun itself is in the base image)
COPY --from=deps /app/node_modules ./node_modules

# Built frontend (SSR server + client assets)
COPY --from=builder /app/dist ./dist

# API server source (runs directly with bun, no transpile step needed)
COPY server ./server
COPY src ./src

# Config files needed at runtime
COPY package.json bun.lock tsconfig.json vite.config.ts ./

# Persistent SQLite volume mount point
RUN mkdir -p data

EXPOSE 3333

# API server on :3334 (internal), vite preview on :3333 (public-facing)
# vite preview proxies /api and /socket.io → :3334 via vite.config.ts preview.proxy
CMD ["sh", "-c", "bun run server/index.ts & exec bun --bun run preview"]
