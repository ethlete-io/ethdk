import { tmpdir } from 'os';
import { join } from 'path';

const flattened = (value: string) => value.replace(/[^A-Za-z0-9]/gu, '-');

/**
 * Where the state of one call is kept: next to Ethlete Studio's check receipts. Studio watches the
 * folder for the `.status.json` suffix in `apps/ethlete-studio/src-tauri/src/call_status.rs`. Both sides must agree.
 */
export const statusPath = (options: { checkout: string; slug: string }) =>
  join(tmpdir(), 'ethlete-studio-checks', `${flattened(`${options.checkout} ${options.slug}`)}.status.json`);
