#!/usr/bin/env node
// init-project.mjs — bootstrap script para arrancar un nuevo proyecto desde el skeleton.
//
// Uso:
//   node scripts/init-project.mjs <new-project-name>
//
// Hace:
//   1. Renombra `name` y `description` en package.json
//   2. Genera COOKIE_SECRET aleatorio + RSA keypair y los escribe en .env (si no existe)
//   3. Imprime checklist de cosas a hacer manualmente

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { join } from 'node:path';

const projectName = process.argv[2];
if (!projectName) {
  console.error('Usage: node scripts/init-project.mjs <new-project-name>');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]{1,40}$/.test(projectName)) {
  console.error('Project name must match /^[a-z][a-z0-9-]{1,40}$/');
  process.exit(1);
}

const root = process.cwd();

// 1. package.json --------------------------------------------------------------
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldName = pkg.name;
pkg.name = projectName;
pkg.version = '0.1.0';
pkg.description = `${projectName} — built from nestjs-skeleton`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`[init] renamed package: ${oldName} → ${projectName}`);

// 2. .env ----------------------------------------------------------------------
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  console.log('[init] .env already exists — skipping (delete it if you want regen)');
} else {
  const examplePath = join(root, '.env.example');
  let env = readFileSync(examplePath, 'utf8');

  // COOKIE_SECRET: 48 random bytes base64
  const cookieSecret = randomBytes(48).toString('base64url');
  env = env.replace(
    /^COOKIE_SECRET=.*$/m,
    `COOKIE_SECRET=${cookieSecret}`,
  );

  // JWT keypair RS256
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const priv = privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString()
    .replace(/\n/g, '\\n');
  const pub = publicKey.export({ format: 'pem', type: 'spki' }).toString().replace(/\n/g, '\\n');
  env = env.replace(/^JWT_PRIVATE_KEY=.*$/m, `JWT_PRIVATE_KEY="${priv}"`);
  env = env.replace(/^JWT_PUBLIC_KEY=.*$/m, `JWT_PUBLIC_KEY="${pub}"`);

  writeFileSync(envPath, env);
  console.log('[init] wrote .env with random COOKIE_SECRET + RS256 keypair');
}

// 3. Checklist -----------------------------------------------------------------
console.log(`
[init] done.

Next steps:
  1. Review .env and fill OAuth credentials if you'll use Google/GitHub login
  2. Configure SMTP (or keep ConsoleMailer for dev) — see .env vars SMTP_*
  3. pnpm install
  4. pnpm compose:up                              # postgres + redis + api
  5. pnpm db:migrate:deploy && pnpm db:seed
  6. open http://localhost:3000/api/docs

If you want to start fresh git history:
  rm -rf .git && git init && git add -A && git commit -m "chore: initial commit from skeleton"
`);
