/**
 * Object storage — MVP implementation stores files on local disk under
 * `server/data/storage/`. Swap-in point for DigitalOcean Spaces / S3:
 * the S3-shaped API below (saveObject/readObject/deleteObject) maps 1:1.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const STORAGE_DIR = path.join(config.dataDir, 'storage');

function resolveKey(key: string): string {
  const full = path.join(STORAGE_DIR, key);
  if (!full.startsWith(STORAGE_DIR)) throw new Error('Invalid storage key');
  return full;
}

export function saveObject(key: string, content: string | Buffer): string {
  const full = resolveKey(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return key;
}

export function readObject(key: string): Buffer {
  return fs.readFileSync(resolveKey(key));
}

export function deleteObject(key: string): void {
  try {
    fs.unlinkSync(resolveKey(key));
  } catch {
    /* already gone */
  }
}
