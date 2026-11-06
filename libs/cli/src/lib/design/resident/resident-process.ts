import { randomUUID } from 'crypto';
import { DesignConfig, readConfig } from '../paths';
import { buildStampOf } from '../stamp';
import { createDesignServer } from '../serve';
import { createDrawQueue } from '../thumb';
import { designSketch } from '../sketch-command';
import { designCompare, shootStatesWith } from '../system/compare-command';
import { StartHarnessServer, startHarnessServer } from '../system/harness-server';
import { createHarnessWatch } from '../system/harness-watch';
import { designMocksFresh, guardsDesignMocks } from '../system/stale-design-mocks';
import { libBuildStampOf, readFreshDist } from '../system/stale-dist';
import { recordPhase, recordRun, timingsFileOf } from '../timings';
import { WarmDraw } from '../warm-draw';
import { runsInResident } from './client';
import { removeDiscovery, writeDiscovery } from './discovery';
import { ResidentRun, startResidentServer } from './server';

type DesignServer = Awaited<ReturnType<typeof createDesignServer>>;

/**
 * Runs `compare`, `sketch check` and `sketch ready` with a design server, Chromium and a watch-built harness app that stay up
 * between requests. Each request reads the lib build under the lib-build lock only while it runs, a changed lib build or
 * design config restarts the design server and Chromium before it draws, and every request draws the design files as
 * they are when it starts.
 */
export const createWarmRuns = (options: { target: string }) => {
  const { target } = options;
  let stamp: string | null = null;
  let server: Promise<DesignServer> | null = null;
  let queue: ReturnType<typeof createDrawQueue> | null = null;
  const harness = createHarnessWatch({ target });

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
    const served = await harness.current(product);

    if (served === null) return startHarnessServer({ target, product });

    return typeof served === 'string' ? served : { url: served.url, stop: async () => undefined };
  };

  const refresh = async (config: DesignConfig | null) => {
    const next = `${libBuildStampOf({ target, config })}#${JSON.stringify(config)}`;

    if (stamp !== null && stamp !== next && (server || queue)) {
      console.error('the lib build or the design config changed - restarting the warm design server and Chromium');
      await closeDraw();
    }

    stamp = next;
    (await server?.catch(() => null))?.forgetDrawn();
  };

  const runIn = async ({ argv, invocation }: { argv: string[]; invocation: string }) => {
    if (!runsInResident(argv)) {
      console.error(
        `the resident design process runs compare, sketch check and sketch ready only, not ${argv.join(' ')}`,
      );

      return 2;
    }

    if (guardsDesignMocks(argv) && !designMocksFresh({ target })) return 1;

    const config = readConfig(target);
    const read = await readFreshDist({ target, config });

    if (!read.ok) return 1;

    try {
      await refresh(config);

      const rest = argv.slice(1);

      if (argv[0] === 'sketch') return await designSketch({ target, argv: rest, invocation, warm });

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

  const run: ResidentRun = ({ argv, invocation, waitedMs }) =>
    recordRun({ file: timingsFileOf(target), argv, resident: true }, () => {
      if (waitedMs !== undefined) recordPhase('resident-queue-wait', waitedMs);

      return runIn({ argv, invocation });
    });

  const warmUp = async () => {
    const config = readConfig(target);

    if (!config) return;

    await refresh(config);
    await warm.server(config);
    await warm.queue().run(async () => undefined);
  };

  const close = async () => {
    await closeDraw();
    await harness.stop();
  };

  return { run, warmUp, close };
};

/** `et design __resident`: the resident design process of the checkout, until it idles out or is stopped. */
export const serveResident = async (options: { target: string }) => {
  const { target } = options;
  const build = buildStampOf().build;
  const token = randomUUID();
  const runs = createWarmRuns({ target });
  let exiting = false;
  let close = async () => undefined as void;
  const exit = async (reason: string) => {
    if (exiting) return;

    exiting = true;
    console.error(`resident design process exits: ${reason}`);
    removeDiscovery(target, process.pid);
    await close();
    await runs.close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void exit('SIGTERM'));
  process.once('SIGINT', () => void exit('SIGINT'));

  const server = await startResidentServer({
    token,
    identity: { pid: process.pid, build, checkout: target },
    run: runs.run,
    onExit: (reason) => void exit(reason === 'idle' ? 'idle for 30 min' : 'stopped'),
  });

  close = server.close;

  await runs.warmUp().catch((error: unknown) => console.error(`warm-up failed: ${String(error)}`));

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
