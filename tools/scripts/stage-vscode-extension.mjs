import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Puts the packaged reporter where the Tauri bundle picks it up, so the app can install the extension
 * from a button instead of asking for a checkout.
 *
 * The copy drops the version out of the filename: the Rust side resolves one fixed resource path, and
 * would otherwise have to know which extension version this build holds.
 */
const OUT_DIR = resolve('apps/timetrack/src-tauri/resources');

const { version } = JSON.parse(readFileSync(resolve('apps/timetrack-vscode/package.json'), 'utf8'));
const vsix = resolve(`dist/apps/timetrack-vscode/timetrack-vscode-${version}.vsix`);

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(vsix, resolve(OUT_DIR, 'timetrack-vscode.vsix'));

console.log(resolve(OUT_DIR, 'timetrack-vscode.vsix'));
