#!/usr/bin/env node
/**
 * Starts the Docker stack on ports that are actually free.
 *
 * Why a script rather than plain `docker compose up`
 * --------------------------------------------------
 * Compose cannot fall back when a host port is taken — it just fails to bind.
 * And `NEXT_PUBLIC_API_URL` is inlined into the frontend bundle at *build*
 * time, so the frontend has to know which port the backend landed on before
 * its image is built. Port selection therefore has to happen up front, which
 * is exactly what this does.
 *
 * Usage:
 *   npm run up                 # pick free ports, build, start detached
 *   npm run up -- --attach     # stream logs instead of detaching
 *   npm run up -- --no-build   # skip the image rebuild
 *   npm run up -- --dry-run    # show the chosen ports without starting
 *   npm run up -- --dev        # hot-reload stack (docker-compose.dev.yml, explicit -f)
 *   FRONTEND_PORT=4000 npm run up   # pin a port; the script still verifies it
 *
 * Ports already set in the environment (or in .env) are honoured — the script
 * only searches when a port is unset or unavailable.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Split on either line ending; .env may have been written by any tool. */
const NEWLINE_RE = new RegExp('\\r?\\n');

const SERVICES = [
  { key: 'FRONTEND_PORT', label: 'frontend', preferred: 3000 },
  { key: 'BACKEND_PORT', label: 'backend', preferred: 3001 },
  { key: 'POSTGRES_PORT', label: 'postgres', preferred: 5432 },
];

/** How many consecutive ports to try before giving up. */
const SEARCH_RANGE = 40;

/**
 * True when something is already accepting connections on `port`.
 *
 * This connects rather than trying to bind. On Windows a second process can
 * often bind a port another one already holds, so a bind test reports "free"
 * for a port that is in practice shadowed — we hit exactly that with a native
 * Postgres service and Docker's proxy both on 5432, where connections were
 * routed non-deterministically. A connect test sees what a user's browser
 * would see.
 */
function inUse(port, host = '127.0.0.1', timeout = 400) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Read KEY=VALUE pairs out of .env so a pinned port there is respected. */
function readDotEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(NEWLINE_RE)) {
    if (line.trimStart().startsWith('#')) continue;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function pickPort(preferred, taken) {
  for (let port = preferred; port < preferred + SEARCH_RANGE; port++) {
    if (taken.has(port)) continue;
    if (!(await inUse(port))) return port;
  }
  throw new Error(
    `No free port found in ${preferred}-${preferred + SEARCH_RANGE - 1}. ` +
      `Free one up, or set the port explicitly in .env.`,
  );
}

const argv = process.argv.slice(2);
const attach = argv.includes('--attach');
const noBuild = argv.includes('--no-build');
const dryRun = argv.includes('--dry-run');
// docker-compose.dev.yml (formerly docker-compose.override.yml) is never
// auto-merged — a real outage was caused by exactly that behavior: a bare
// `docker compose up -d backend` silently applied the dev command to the
// already-built PRODUCTION image without rebuilding it, and the container
// crashed on boot with no restart policy to recover it. Both modes now name
// their files explicitly, so a bare `docker compose <anything>` (restart,
// logs, up) can never land on the wrong one by accident.
const dev = argv.includes('--dev');
const composeFiles = dev
  ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml']
  : ['-f', 'docker-compose.yml'];

/**
 * Host ports this project's own containers already publish.
 *
 * Without this, re-running `npm run up` on a running stack sees its own
 * containers occupying 3000/3001/5432, decides they are busy, and walks every
 * port upward one slot per restart. Ports the stack is about to reclaim are
 * not conflicts.
 */
function ownPorts() {
  try {
    const out = execFileSync(
      'docker',
      ['compose', ...composeFiles, 'ps', '--format', '{{.Publishers}}'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // Publishers render as `[{0.0.0.0 3000 3005 tcp} {:: 3000 3005 tcp}]`,
    // where the third field is the published host port.
    const ports = new Set();
    for (const match of out.matchAll(/\{\S+\s+\d+\s+(\d+)\s+\w+\}/g)) {
      ports.add(Number(match[1]));
    }
    return ports;
  } catch {
    // Docker missing or the project not running — nothing to reclaim.
    return new Set();
  }
}

const dotenv = readDotEnv();
const reclaimable = ownPorts();

// An explicit value (shell env wins over .env) is a request, not a promise —
// it still gets verified before being handed to Compose.
const wants = SERVICES.map(({ key, label, preferred }) => {
  const pinned = Number(process.env[key] ?? dotenv[key]) || null;
  return { key, label, pinned, want: pinned ?? preferred };
});

const busy = await Promise.all(
  wants.map(async (w) => (reclaimable.has(w.want) ? false : inUse(w.want))),
);

const taken = new Set();
const chosen = {};
const moved = [];

// Two passes, so a service that has to move cannot take a port another service
// was going to use. One pass in declaration order would let the frontend claim
// 3001 whenever 3000 was busy, needlessly displacing the backend from its own
// default.
wants.forEach((w, i) => {
  if (!busy[i] && !taken.has(w.want)) {
    taken.add(w.want);
    chosen[w.key] = String(w.want);
  }
});

for (const w of wants) {
  if (chosen[w.key]) continue;
  const port = await pickPort(w.want + 1, taken);
  moved.push({ label: w.label, want: w.want, port, pinned: w.pinned !== null });
  taken.add(port);
  chosen[w.key] = String(port);
}

const frontendPort = chosen.FRONTEND_PORT;
const backendPort = chosen.BACKEND_PORT;
const databaseUrl = `postgresql://kanban:kanban@localhost:${chosen.POSTGRES_PORT}/kanban?schema=public`;

// Derived values. Compose cannot compute these itself: it does not resolve a
// nested `${...}` inside a default, and falls back silently to the inner
// literal — which would leave the frontend calling a backend that isn't there.
const env = {
  ...process.env,
  ...chosen,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? `http://localhost:${frontendPort}`,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${backendPort}/api`,
};

for (const { label, want, port, pinned } of moved) {
  const why = pinned ? 'requested port is busy' : 'default is busy';
  console.log(`  ${label}: ${want} -> ${port}  (${why})`);
}
if (moved.length) console.log('');

console.log(`  frontend   http://localhost:${frontendPort}`);
console.log(`  API        http://localhost:${backendPort}/api`);
console.log(`  postgres   localhost:${chosen.POSTGRES_PORT}`);
console.log(`  mode       ${dev ? 'development (hot reload)' : 'production (compiled images)'}`);
console.log('');

if (dryRun) {
  console.log('--dry-run: nothing started.');
  process.exit(0);
}

/**
 * Persist the chosen ports back into .env.
 *
 * Compose is not the only consumer: `prisma studio`, `npm run test:e2e` and any
 * host-side psql read DATABASE_URL from the backend env, and would otherwise
 * keep pointing at a port nothing is listening on — which surfaces as a silent
 * hang on connect rather than an error. Writing them back also makes ports
 * stable across restarts, since the next run treats them as pinned and
 * re-verifies rather than re-searching.
 */
function persistPorts() {
  const file = join(ROOT, '.env');
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(NEWLINE_RE) : [];
  const want = {
    ...chosen,
    CORS_ORIGIN: env.CORS_ORIGIN,
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
  };

  for (const [key, value] of Object.entries(want)) {
    const pattern = new RegExp('^\\s*#?\\s*' + key + '\\s*=');
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(file, lines.join('\n'));

  // backend/.env is a separate file, and it is the one host tooling reads:
  // `prisma studio`, `prisma migrate`, and `npm run test:e2e` all resolve
  // DATABASE_URL from there, not from the compose env. Leaving it pointing at
  // a stale port is what made an e2e run hang on connect with no error.
  const backendEnv = join(ROOT, 'backend', '.env');
  if (existsSync(backendEnv)) {
    const backendLines = readFileSync(backendEnv, 'utf8').split(NEWLINE_RE);
    const pattern = new RegExp('^\\s*#?\\s*DATABASE_URL\\s*=');
    const index = backendLines.findIndex((line) => pattern.test(line));
    const next = `DATABASE_URL=${databaseUrl}`;
    if (index >= 0) backendLines[index] = next;
    else backendLines.push(next);
    writeFileSync(backendEnv, backendLines.join('\n'));
  }

  console.log('  wrote the chosen ports to .env, and DATABASE_URL to backend/.env');
  console.log(`  host tooling (prisma studio, npm run test:e2e) -> localhost:${chosen.POSTGRES_PORT}`);
  console.log('');
}
persistPorts();

const args = [
  'compose',
  ...composeFiles,
  'up',
  ...(noBuild ? [] : ['--build']),
  ...(attach ? [] : ['-d']),
];
const child = spawn('docker', args, {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  if (code === 0 && !attach) {
    console.log(`\nStack is up. Open http://localhost:${frontendPort}`);
    console.log('Logs:  npm run logs     Stop:  npm run down');
  }
  process.exit(code ?? 1);
});
