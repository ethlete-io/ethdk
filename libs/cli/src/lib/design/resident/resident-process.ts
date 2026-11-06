import { randomUUID } from 'crypto';
import { DesignConfig, readConfig } from '../paths';
import { buildStampOf } from '../stamp';
import { createDesignServer } from '../serve';
import { createDrawQueue } from '../thumb';
import { designCompare, shootStatesWith, WarmDraw } from '../system/compare-command';
import { HarnessServer, harnessKeyOf, StartHarnessServer, startHarnessServer } from '../system/harness-server';
import { designMocksFresh, guardsDesignMocks } from '../system/stale-design-mocks';
import { libBuildStampOf, readFreshDist } from '../system/stale-dist';
import { removeDiscovery, writeDiscovery } from './discovery';
import { ResidentRun, startResidentServer } from './server';

type DesignServer = Awaited<ReturnType<typeof createDesignServer>>;

/**
 * Runs `compare` with a design server, Chromium and harness app that stay up between requests. Each request reads
 * the lib build under the lib-build lock only while it runs, and a changed lib build or design config restarts the
 * design server and Chromium before it draws.
 */
export const createWarmCompare = (options: { target: string }) => {
  const { target } = options;
  let stamp: string | null = null;
  let server: Promise<DesignServer> | null = null;
  let queue: ReturnType<typeof createDrawQueue> | null = null;
  let harness: { key: string; server: HarnessServer } | null = null;

  const closeDraw = async () => {
    const [closingServer, closingQueue] = [server, queue];

    server = null;
    queue = null;
    await closingQueue?.close();
    await (await closingServer?.catch(() => null))?.close();
  };

  const startServer = async (config: DesignConfig) => {
    const started = await createDesignServer({ target, config, listen: true, port: 0 });

    try {
      await started.listen();
    } catch (error) {
      await started.close();

      throw error;
    }

    return started;
  };

  const warm: WarmDraw = {
    server: (config) => {
      server ??= startServer(config).catch((error: unknown) => {
        server = null;

        throw error;
      });

      return server;
    },
    queue: () => (queue ??= createDrawQueue({ target })),
  };

  const start: StartHarnessServer = async ({ product }) => {
    const key = harnessKeyOf({ target, product });

    if (key !== null && harness?.key === key) return { url: harness.server.url, stop: async () => undefined };

    await harness?.server.stop();
    harness = null;

    const started = await startHarnessServer({ target, product });

    if (typeof started === 'string' || key === null) return started;

    harness = { key, server: started };

    return { url: started.url, stop: async () => undefined };
  };

  const refresh = async (config: DesignConfig | null) => {
    const next = `${libBuildStampOf({ target, config })}#${JSON.stringify(config)}`;

    if (stamp !== null && stamp !== next && (server || queue)) {
      console.error('the lib build or the design config changed - restarting the warm design server and Chromium');
      await closeDraw();
    }

    stamp = next;
  };

  const run: ResidentRun = async ({ argv, invocation }) => {
    if (argv[0] !== 'compare') {
      console.error(`the resident design process runs compare only, not ${argv[0] ?? 'nothing'}`);

      return 2;
    }

    if (guardsDesignMocks(argv) && !designMocksFresh({ target })) return 1;

    const config = readConfig(target);
    const read = await readFreshDist({ target, config });

    if (!read.ok) return 1;

    try {
      await refresh(config);

      const rest = argv.slice(1);

      return await designCompare({
        target,
        argv: rest,
        invocation,
        start,
        ...(rest.includes('--live') ? {} : { shoot: shootStatesWith(warm) }),
      });
    } finally {
      read.release();
    }
  };

  const warmUp = async () => {
    const config = readConfig(target);

    if (!config) return;

    await refresh(config);
    await warm.server(config);
    await warm.queue().run(async () => undefined);
  };

  const close = async () => {
    await closeDraw();
    await harness?.server.stop();
    harness = null;
  };

  return { run, warmUp, close };
};

/** `et design __resident`: the resident design process of the checkout, until it idles out or is stopped. */
export const serveResident = async (options: { target: string }) => {
  const { target } = options;
  const build = buildStampOf().build;
  const token = randomUUID();
  const compare = createWarmCompare({ target });
  let exiting = false;
  let close = async () => undefined as void;
  const exit = async (reason: string) => {
    if (exiting) return;

    exiting = true;
    console.error(`resident design process exits: ${reason}`);
    removeDiscovery(target, process.pid);
    await close();
    await compare.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void exit('SIGTERM'));
  process.once('SIGINT', () => void exit('SIGINT'));

  const server = await startResidentServer({
    token,
    identity: { pid: process.pid, build, checkout: target },
    run: compare.run,
    onExit: (reason) => void exit(reason === 'idle' ? 'idle for 30 min' : 'stopped'),
  });

  close = server.close;

  await compare.warmUp().catch((error: unknown) => console.error(`warm-up failed: ${String(error)}`));

  writeDiscovery(target, {
    pid: process.pid,
    port: server.port,
    checkout: target,
    build,
    token,
    startedAt: new Date().toISOString(),
  });
  console.error(`resident design process ${process.pid} serves on 127.0.0.1:${server.port}`);

  return new Promise<number>(() => undefined);
};
