/**
 * Starts the API for Playwright.
 *
 * Playwright launches webServer *before* globalSetup, so DB reset must happen
 * here — otherwise drop/terminate kills the live Prisma connection (P1017).
 */
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "server");

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://keyafe:keyafeDevPass@127.0.0.1:5432/keyafe_e2e?schema=public";

function run(cmd, cwd = root, env = process.env) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, env: { ...env, FORCE_COLOR: "0" }, stdio: "inherit" });
}

function ensureDatabase() {
  const existsSql = "SELECT 1 FROM pg_database WHERE datname = 'keyafe_e2e'";
  try {
    const out = execSync(
      `docker exec keyafe-postgres psql -U keyafe -d postgres -tAc "${existsSql}"`,
      { encoding: "utf8" },
    ).trim();
    if (!out) {
      run(`docker exec keyafe-postgres psql -U keyafe -d postgres -c "CREATE DATABASE keyafe_e2e;"`);
    } else {
      console.log("Database keyafe_e2e already exists");
    }
  } catch (err) {
    console.error(
      "Could not reach Docker Postgres (keyafe-postgres). Start it with: pnpm db:up",
    );
    throw err;
  }
}

ensureDatabase();

run(
  `docker exec keyafe-postgres psql -U keyafe -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'keyafe_e2e' AND pid <> pg_backend_pid();"`,
);
run(`docker exec keyafe-postgres psql -U keyafe -d postgres -c "DROP DATABASE IF EXISTS keyafe_e2e;"`);
run(`docker exec keyafe-postgres psql -U keyafe -d postgres -c "CREATE DATABASE keyafe_e2e;"`);

const e2eEnv = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  ADMIN_BOOTSTRAP_PHONE: process.env.ADMIN_BOOTSTRAP_PHONE ?? "9883186892",
};

run(`pnpm exec prisma migrate deploy`, serverDir, e2eEnv);
run(`pnpm exec prisma db seed`, serverDir, e2eEnv);
run(`pnpm exec tsx ../e2e/seed-coupon.ts`, serverDir, e2eEnv);

const child = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
  cwd: serverDir,
  env: e2eEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
