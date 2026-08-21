import { createServer } from 'net';

const indentOf = (line: string) => line.length - line.trimStart().length;

const PUBLISHED_KEY = /^published:\s*['"]?(\d+)/;

/**
 * Host port of a short-form entry such as `8040:80`, `127.0.0.1:8040:80` or `[::1]:8040:80/udp`.
 * It is the second-to-last segment, so a bind address of any shape stays out of the way. An entry
 * that names only a container port, or a port range, has no single host port to check.
 */
const shortFormHostPort = (entry: string) => {
  const parts = entry.replace(/['"]/g, '').split('/')[0]?.split(':') ?? [];

  if (parts.length < 2) return undefined;

  const host = parts[parts.length - 2] ?? '';

  return /^\d+$/.test(host) ? Number(host) : undefined;
};

/**
 * Host ports the named services publish, read from the resolved output of `compose config`. It
 * accepts the short form podman-compose prints and the long form docker compose prints.
 *
 * Only the named services are read. A compose file usually declares more than an app needs, and a
 * service that never starts must not make a port look taken.
 */
export const publishedPorts = (options: { config: string; services: readonly string[] }) => {
  const { config, services } = options;
  const wanted = new Set(services);
  const ports = new Set<number>();

  let servicesIndent: number | undefined;
  let serviceIndent: number | undefined;
  let portsIndent: number | undefined;
  let inWantedService = false;

  for (const line of config.split('\n')) {
    const text = line.trim();

    if (text === '' || text.startsWith('#')) continue;

    const indent = indentOf(line);

    if (servicesIndent === undefined) {
      if (text === 'services:') servicesIndent = indent;

      continue;
    }

    if (indent <= servicesIndent && !text.startsWith('-')) {
      servicesIndent = text === 'services:' ? indent : undefined;
      serviceIndent = undefined;
      portsIndent = undefined;
      inWantedService = false;

      continue;
    }

    serviceIndent ??= indent;

    if (indent === serviceIndent) {
      inWantedService = wanted.has(text.replace(/:$/, ''));
      portsIndent = undefined;

      continue;
    }

    if (!inWantedService) continue;

    if (text === 'ports:') {
      portsIndent = indent;

      continue;
    }

    if (portsIndent === undefined) continue;

    if (indent < portsIndent || (indent === portsIndent && !text.startsWith('-'))) {
      portsIndent = undefined;

      continue;
    }

    const published = PUBLISHED_KEY.exec(text)?.[1];

    if (published !== undefined) {
      ports.add(Number(published));

      continue;
    }

    if (!text.startsWith('-')) continue;

    const short = shortFormHostPort(text.slice(1).trim());

    if (short !== undefined) ports.add(short);
  }

  return [...ports].sort((a, b) => a - b);
};

const isPortFree = (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });

/** The ports nothing else may bind right now, so `up` cannot publish them. */
export const portsInUse = async (ports: readonly number[]) => {
  const checked = await Promise.all(ports.map(async (port) => ({ port, free: await isPortFree(port) })));

  return checked.filter(({ free }) => !free).map(({ port }) => port);
};
