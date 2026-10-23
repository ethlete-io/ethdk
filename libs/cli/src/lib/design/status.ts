import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { callsRootOf } from './paths';

export const CALL_STATES = ['scaffolded', 'drawing', 'checking', 'ready', 'failed'] as const;

export type CallState = (typeof CALL_STATES)[number];

export type CallStatus = {
  state: CallState;
  updatedAt: string;
  message?: string;
};

const MESSAGE_LIMIT = 400;

const flattened = (value: string) => value.replace(/[^A-Za-z0-9]/gu, '-');

/**
 * Where the state of one call is kept: next to Ethlete Studio's check receipts, named by the same
 * scheme as `status_path` in `apps/ethlete-studio/src-tauri/src/call_status.rs`. Both sides must agree.
 */
export const statusPath = (options: { checkout: string; slug: string }) =>
  join(tmpdir(), 'ethlete-studio-checks', `${flattened(`${options.checkout} ${options.slug}`)}.status.json`);

/** Records the state a call is in, for Ethlete Studio to show. */
export const writeStatus = (options: { checkout: string; slug: string; state: CallState; message?: string }) => {
  const { checkout, slug, state, message } = options;
  const path = statusPath({ checkout, slug });
  const status: CallStatus = {
    state,
    updatedAt: new Date().toISOString(),
    ...(message ? { message: message.slice(0, MESSAGE_LIMIT) } : {}),
  };

  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(status));
};

/** Remembers a call's status as it is now, and answers with the function that puts it back. */
export const holdStatus = (options: { checkout: string; slug: string }) => {
  const path = statusPath(options);
  const held = existsSync(path) ? readFileSync(path, 'utf8') : null;

  return () => {
    if (held === null) {
      rmSync(path, { force: true });
    } else {
      writeFileSync(path, held);
    }
  };
};

const isState = (value: string | undefined): value is CallState => CALL_STATES.includes(value as CallState);

/** `et design status <slug> <state>` records the state of a call by hand. */
export const designStatus = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const [slug, state] = argv;

  if (!slug || !isState(state)) {
    console.error(`usage: ${invocation} status <slug> <${CALL_STATES.join('|')}>`);

    return 2;
  }

  if (!existsSync(join(callsRootOf(target), ...slug.split('/')))) {
    console.error(`NO CALL "${slug}" - pass the folder's path under .ethlete/design/calls.`);

    return 1;
  }

  writeStatus({ checkout: target, slug, state });
  console.log(`${slug} is ${state}`);

  return 0;
};
