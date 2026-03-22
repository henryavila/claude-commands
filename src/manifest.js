import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_DIR = '.atomic-skills';
export const MANIFEST_FILE = 'manifest.json';

export function readManifest(projectDir) {
  const filePath = join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function writeManifest(projectDir, data) {
  const dir = join(projectDir, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, MANIFEST_FILE);
  data.updated_at = new Date().toISOString();
  if (!data.installed_at) data.installed_at = data.updated_at;
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
