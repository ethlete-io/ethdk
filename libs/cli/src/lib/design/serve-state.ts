import { ServerIdentity } from './server-identity';
import { BuildStamp, stampUrlsOf, startCommandOf } from './stamp';

type Served = Partial<ServerIdentity> & Partial<BuildStamp>;

const fetchServed = async (base: string): Promise<Served | null> => {
  for (const url of stampUrlsOf(base)) {
    try {
      return (await (await fetch(url)).json()) as Served;
    } catch {
      continue;
    }
  }

  return null;
};

/** The lines that say who serves the design port, which cli build it runs against `own`, and how to restart it. */
export const serveStateLines = (options: { base: string; own: BuildStamp; served: Served | null }) => {
  const { base, own, served } = options;

  if (!served) return [`serve: nothing answers at ${base}. Start it with \`${startCommandOf(base)}\`, or open Studio.`];

  const stamp = served.stamp ?? (served.version && served.build ? (served as BuildStamp) : null);
  const owner = served.owner ?? 'unknown';
  const pid = served.pid ?? 'unknown';
  const label = { studio: 'the Studio app', terminal: 'a terminal', unknown: 'an unknown owner (an older cli)' }[owner];
  const same = !!stamp && stamp.version === own.version && stamp.build === own.build;
  const restart =
    owner === 'studio'
      ? 'Press restart in Studio (the design_server_restart command). Do not kill the process, Studio would be left without a server.'
      : owner === 'terminal'
        ? `Stop pid ${pid} (Ctrl+C in its terminal) and run \`${startCommandOf(base)}\` again.`
        : `Restart whatever started pid ${pid}; Studio if it runs in the Studio app.`;

  return [
    `serve: ${base} is served by ${label} (pid ${pid})`,
    `serve: cli ${stamp ? `${stamp.version} build ${stamp.build}` : 'unknown'}${served.cliRoot ? ` from ${served.cliRoot}` : ''}`,
    `serve: this checkout's cli is ${own.version} build ${own.build}: ${same ? 'the server runs it' : 'the server runs a different build'}`,
    `serve: ${same ? 'to restart' : 'to load this cli'}: ${restart}`,
  ];
};

/** Prints the serve state of `base`; exits 0 also when nothing answers. */
export const designServeState = async (options: { base: string; own: BuildStamp }) => {
  const served = await fetchServed(options.base);

  console.log(serveStateLines({ ...options, served }).join('\n'));

  return 0;
};
