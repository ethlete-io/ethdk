import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join, posix, resolve, win32 } from 'path';
import { firstValueFrom, timer } from 'rxjs';
import { configPathOf } from './design-config';
import { failedText } from './failure-line';

const REQUEST_SUFFIX = '.open.json';
const REPLY_SUFFIX = '.opened.json';
const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_POLL_MS = 50;

/** Exit code of `studio open` when Studio is down and the request was kept: not a failure, not yet shown. */
export const STUDIO_OPEN_QUEUED_EXIT = 3;

type Reply = { ok: boolean; message: string };

/**
 * The folder where `studio open` requests wait for Studio. It must survive a reboot, so it is not the temp folder, and
 * it must match `open_requests_dir` in `apps/ethlete-studio/src-tauri/src/studio_open.rs`.
 */
export const openRequestsDirOf = ({
  platform = process.platform,
  env = process.env,
  home = homedir(),
}: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; home?: string } = {}) => {
  if (platform === 'win32')
    return win32.join(env['LOCALAPPDATA'] || win32.join(home, 'AppData', 'Local'), 'ethlete-studio', 'open-requests');

  if (platform === 'darwin')
    return posix.join(home, 'Library', 'Application Support', 'ethlete-studio', 'open-requests');

  return posix.join(env['XDG_STATE_HOME'] || posix.join(home, '.local', 'state'), 'ethlete-studio', 'open-requests');
};

const wait = (ms: number) => firstValueFrom(timer(ms));

const replyOf = (path: string): Reply | null => {
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Reply;
  } catch {
    return null;
  }
};

/**
 * Asks a running Studio to keep `checkout` and show it. The request is a file in the folder Studio watches
 * (`apps/ethlete-studio/src-tauri/src/studio_open.rs`); both sides must agree on the suffixes. No reply means no Studio: the request stays, and Studio adds the checkout when it next starts.
 */
const requestOpen = async (options: { checkout: string; requestsDir: string; timeoutMs: number; pollMs: number }) => {
  const { checkout, requestsDir, timeoutMs, pollMs } = options;
  const id = randomUUID();
  const request = join(requestsDir, `${id}${REQUEST_SUFFIX}`);
  const replyPath = join(requestsDir, `${id}${REPLY_SUFFIX}`);

  mkdirSync(requestsDir, { recursive: true });
  writeFileSync(request, JSON.stringify({ checkout }));

  const deadline = Date.now() + timeoutMs;

  try {
    for (;;) {
      const reply = replyOf(replyPath);

      if (reply) {
        rmSync(request, { force: true });

        return reply;
      }

      if (Date.now() >= deadline) return null;

      await wait(pollMs);
    }
  } finally {
    rmSync(replyPath, { force: true });
  }
};

/** `et design studio open [<dir>]`: adds a checkout to the running Studio's list and switches Studio to it. */
export const designStudio = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  requestsDir?: string;
  timeoutMs?: number;
  pollMs?: number;
}) => {
  const { target, argv, invocation } = options;
  const [verb, dir, ...extra] = argv;

  if (verb !== 'open' || extra.length > 0) {
    console.error(`USAGE ${invocation} studio open [<dir>]`);

    return 1;
  }

  if (process.env['CLEAN_SLATE_SANDBOX']) {
    console.error(
      failedText('A client run does not add checkouts to the human Studio. Show the result through its shots instead.'),
    );

    return 1;
  }

  const checkout = dir ? resolve(dir) : target;

  if (!existsSync(configPathOf(checkout))) {
    console.error(
      failedText(
        `${checkout} holds no .ethlete/design/config.json, so it carries no design work. Studio was not asked.`,
      ),
    );

    return 1;
  }

  const reply = await requestOpen({
    checkout,
    requestsDir: options.requestsDir ?? openRequestsDirOf(),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.pollMs ?? DEFAULT_POLL_MS,
  });

  if (!reply) {
    console.log(`Studio is not running; it adds ${checkout} when it next starts (request kept 7 days).`);

    return STUDIO_OPEN_QUEUED_EXIT;
  }

  if (!reply.ok) {
    console.error(failedText(`Studio refused ${checkout}: ${reply.message}`));

    return 1;
  }

  console.log(`Studio now shows ${checkout}.`);

  return 0;
};
