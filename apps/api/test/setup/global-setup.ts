import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/** e2e oncesi: semayi uygula + 2 saticili seed'i kur (§4). Gercek Postgres gerekir. */
export default function setup(): void {
  const root = resolve(__dirname, '../../../..');
  config({ path: resolve(root, '.env') });

  const apiDir = resolve(__dirname, '../..');
  const env = { ...process.env, NODE_ENV: 'test' };
  const run = (cmd: string) => execSync(cmd, { cwd: apiDir, env, stdio: 'inherit' });

  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
}
