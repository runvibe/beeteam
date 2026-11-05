import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function readAppVersion(cargoPath = fileURLToPath(new URL('../../Cargo.toml', import.meta.url))) {
  const cargo = readFileSync(cargoPath, 'utf8');
  const section = cargo.match(/^\[package\]\s*\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  const version = section?.match(/^version\s*=\s*"([^"]+)"\s*(?:#.*)?$/m)?.[1];
  if (!version) throw new Error('Cargo package version is required for the frontend build');
  return version;
}
