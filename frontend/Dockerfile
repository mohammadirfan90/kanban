# Multi-stage build for the Next.js frontend.
# Uses `output: 'standalone'` from next.config.mjs so the runner stage
# only needs the standalone bundle (no full node_modules).
# See specs/11-docker.md for the design rationale.

# ── Stage 1: deps ────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./

RUN npm ci

# ── Stage 2: builder ────────────────────────────────────────────────
# Produces .next/standalone (with a server.js that has only the runtime
# deps) and .next/static (the JS/CSS chunks). NEXT_PUBLIC_* vars are
# inlined at build time — pass via --build-arg from compose.
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Guarantee the directory exists so the runner's COPY cannot fail on a build
# context that ships no public/ folder.
RUN mkdir -p /app/public

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────
# Slim runtime image: standalone bundle + static assets. Runs as a
# non-root user (spec 11 acceptance criterion).
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone bundle (contains its own minimal node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets live separately — Next.js serves them from .next/static.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets. `output: 'standalone'` does not bundle public/, so it has to be
# copied explicitly — without this every /logo.png style request 404s in the
# container while working fine in `next dev`. The builder guarantees the source
# directory exists, so this cannot fail on a context without public/.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
