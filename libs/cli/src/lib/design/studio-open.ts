import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join, resolve } from 'path';
import { firstValueFrom, timer } from 'rxjs';
import { checksDirOf } from './call-status-path';
import { configPathOf } from './design-config';
import { failedText } from './failure-line';

const REQUEST_SUFFIX = '.open.json';
const REPLY_SUFFIX = '.opened.json';
const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_POLL_MS = 50;

type Reply = { ok: boolean; message: string };

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
 * (`apps/ethlete-studio/src-tauri/src/studio_open.rs`); both sides must agree on the suffixes. No reply means no Studio.
 */
const requestOpen = async (options: { checkout: string; checksDir: string; timeoutMs: number; pollMs: number }) => {
  const { checkout, checksDir, timeoutMs, pollMs } = options;
  const id = randomUUID();
  const request = join(checksDir, `${id}${REQUEST_SUFFIX}`);
  const replyPath = join(checksDir, `${id}${REPLY_SUFFIX}`);

  mkdirSync(checksDir, { recursive: true });
  writeFileSync(request, JSON.stringify({ checkout }));

  const deadline = Date.now() + timeoutMs;

  try {
    for (;;) {
      const reply = replyOf(replyPath);

      if (reply) return reply;

      if (Date.now() >= deadline) return null;

      await wait(pollMs);
    }
  } finally {
    rmSync(request, { force: true });
    rmSync(replyPath, { force: true });
  }
};

/** `et design studio open [<dir>]`: adds a checkout to the running Studio's list and switches Studio to it. */
export const designStudio = async (options: {
  target: string;
  argv: string[];
  invocation: string;
  checksDir?: string;
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
    checksDir: options.checksDir ?? checksDirOf(),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    pollMs: options.pollMs ?? DEFAULT_POLL_MS,
  });

  if (!reply) {
    console.error(failedText('Studio is not running. Ask the human to open Studio, then run this command again.'));

    return 1;
  }

  if (!reply.ok) {
    console.error(failedText(`Studio refused ${checkout}: ${reply.message}`));

    return 1;
  }

  console.log(`Studio now shows ${checkout}.`);

  return 0;
};
