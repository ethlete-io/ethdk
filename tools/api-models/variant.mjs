#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const VARIANT_VERSION = /^0\.0\.0-api-[a-z0-9]+(?:-[a-z0-9]+)*-\d{14}$/;

const [packageJsonPath, version, apiBranch, sourceSha, hash, ...rest] = process.argv.slice(2);
if (!hash || rest.length) {
  process.stderr.write('Usage: variant.mjs <package.json> <version> <apiBranch> <sourceSha> <hash>\n');
  process.exit(1);
}
if (!VARIANT_VERSION.test(version)) {
  process.stderr.write(`"${version}" is not a variant version (0.0.0-api-<name>-<yyyymmddHHMMSS>)\n`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
manifest.version = version;
manifest.ethleteApiModels = { apiBranch, sourceSha, hash };
writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
