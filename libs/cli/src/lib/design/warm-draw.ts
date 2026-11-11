import { AddressInfo } from 'net';
import { chromiumOf } from './browser';
import { DesignConfig } from './design-config';
import { createDesignServer } from './serve';
import { createDrawQueue } from './thumb';

export type DesignServer = Awaited<ReturnType<typeof createDesignServer>>;
export type DrawQueue = ReturnType<typeof createDrawQueue>;

/** The design server and Chromium the resident design process keeps up between requests. */
export type WarmDraw = {
  server: (config: DesignConfig) => Promise<DesignServer>;
  queue: () => DrawQueue;
  perRun?: boolean;
  /** The ids the started design server refused as outside its allow list since the last call, none before it starts. */
  takeDeniedIds?: () => string[];
};

export type Drawing = { server: DesignServer; base: string; queue: DrawQueue };

const baseOf = (server: DesignServer) => `http://localhost:${(server.httpServer?.address() as AddressInfo).port}`;

/** Runs `draw` on the warm design server and Chromium, or on a listening design server and Chromium of its own that close after it. */
export const drawingOn = async <T>(
  options: { target: string; config: DesignConfig; warm?: WarmDraw },
  draw: (drawing: Drawing) => Promise<T>,
): Promise<T> => {
  const { target, config, warm } = options;

  if (warm) {
    const server = await warm.server(config);

    return draw({ server, base: baseOf(server), queue: warm.queue() });
  }

  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  const queue = createDrawQueue({ target });

  try {
    await server.listen();

    return await draw({ server, base: baseOf(server), queue });
  } finally {
    await Promise.all([queue.close(), server.close()]);
  }
};

/** Runs `load` on the warm design server, or on an unlistening design server of its own that closes after it. */
export const loadingOn = async <T>(
  options: { target: string; config: DesignConfig; warm?: WarmDraw },
  load: (server: DesignServer) => Promise<T>,
): Promise<T> => {
  const { target, config, warm } = options;

  if (warm) return load(await warm.server(config));

  const server = await createDesignServer({ target, config, listen: false });

  try {
    return await load(server);
  } finally {
    await server.close();
  }
};

/** A design server and Chromium that start on first use and stay up until `close`, shared by every phase of one run. */
export const createRunDraw = (target: string, options: { chromiumOf?: typeof chromiumOf } = {}) => {
  let server: Promise<DesignServer> | null = null;
  let listening: DesignServer | null = null;
  let queue: DrawQueue | null = null;

  const warm: WarmDraw = {
    server: (config) =>
      (server ??= createDesignServer({ target, config, listen: true, port: 0 }).then(async (started) => {
        try {
          await started.listen();
        } catch (error) {
          await started.close();

          throw error;
        }

        listening = started;

        return started;
      })),
    queue: () => (queue ??= createDrawQueue({ target, chromiumOf: options.chromiumOf })),
    perRun: true,
    takeDeniedIds: () => listening?.takeDeniedIds() ?? [],
  };

  const close = async () => {
    await queue?.close();
    await (await server?.catch(() => null))?.close();
  };

  return { warm, close };
};
