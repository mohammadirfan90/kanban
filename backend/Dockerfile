# Multi-stage build for the NestJS API.
# See specs/11-docker.md for the design rationale.

# ── Stage 1: deps ────────────────────────────────────────────────────
# Installs the full dependency tree (including devDependencies) so the
# builder stage has everything it needs to compile TypeScript + run
# Prisma CLI. node_modules here is the largest single layer — we cache
# it by copying package*.json first.
FROM node:24-alpine AS deps
WORKDIR /app

# libc6-compat is needed for bcrypt's native bindings on Alpine.
RUN apk add --no-cache libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# ── Stage 2: builder ────────────────────────────────────────────────
# Generates the Prisma client and compiles the TypeScript source.
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` produces the @prisma/client that NestJS imports.
# The prisma.config.ts loader requires DATABASE_URL to be present, but it
# doesn't have to be a live connection at build time — `generate` only
# reads the schema, never connects. Use a dummy value for the build.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────
# Runtime image: compiled output + the dependency tree from the builder.
# Runs as a non-root user (spec 11 acceptance criterion).
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# Required by `prisma migrate deploy`, which compose runs before the API
# starts. Prisma 7 moved datasource.url out of schema.prisma and into this
# file, so without it the CLI aborts with "The datasource.url property is
# required in your Prisma config file". Omitting it broke the production
# image while the auto-merged dev override kept masking it.
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
