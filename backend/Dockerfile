# Multi-stage build for the NestJS API.
# See specs/11-docker.md for the design rationale.

# ── Stage 1: deps ────────────────────────────────────────────────────
# Installs the full dependency tree (including devDependencies) so the
# builder stage has everything it needs to compile TypeScript + run
# Prisma CLI. node_modules here is the largest single layer — we cache
# it by copying package*.json first.
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat is needed for bcrypt's native bindings on Alpine.
RUN apk add --no-cache libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# ── Stage 2: builder ────────────────────────────────────────────────
# Generates the Prisma client and compiles the TypeScript source.
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` produces the @prisma/client that NestJS imports.
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────
# Slim runtime image: production-only node_modules + compiled output.
# Runs as a non-root user (spec 11 acceptance criterion).
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
