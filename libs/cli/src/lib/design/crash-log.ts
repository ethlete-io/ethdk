import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { CACHE_DIR } from './design-config';

const SEPARATOR = '\n---\n';

/** The gitignored file a dying design server writes its error to; every crash appends one entry. */
export const crashLogPathOf = (target: string) => resolve(target, CACHE_DIR, 'design-server-crash.log');

/** The newest crash in the log: its path and its first line (`<time> pid <pid> port <port>: <error>`), or null when there is none. */
export const lastCrashOf = (target: string) => {
  const path = crashLogPathOf(target);

  if (!existsSync(path)) return null;

  const entry = readFileSync(path, 'utf8').split(SEPARATOR).filter(Boolean).pop();
  const summary = entry?.split('\n')[0];

  return summary ? { path, summary } : null;
};

/**
 * Makes an uncaught exception or unhandled rejection write its stack, the time, the pid and the port
 * to the crash log, print the log path on stderr and exit 1.
 */
export const installCrashLog = (options: {
  target: string;
  port: () => number;
  pid?: number;
  on?: (event: 'uncaughtException' | 'unhandledRejection', handler: (reason: unknown) => void) => void;
  exit?: (code: number) => void;
  stderr?: (text: string) => void;
}) => {
  const {
    target,
    port,
    pid = process.pid,
    on = (event, handler) => void process.on(event, handler),
    exit = (code) => process.exit(code),
    stderr = (text) => void process.stderr.write(text),
  } = options;
  const path = crashLogPathOf(target);

  const record = (reason: unknown) => {
    const text = reason instanceof Error ? (reason.stack ?? `${reason.name}: ${reason.message}`) : String(reason);
    const entry = `${new Date().toISOString()} pid ${pid} port ${port()}: ${text}\n`;

    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${existsSync(path) ? SEPARATOR : ''}${entry}`);
      stderr(`design-explore: crashed, see ${path}\n${text}\n`);
    } catch {
      stderr(`design-explore: crashed, the crash log ${path} could not be written\n${text}\n`);
    }

    exit(1);
  };

  on('uncaughtException', record);
  on('unhandledRejection', record);
};
