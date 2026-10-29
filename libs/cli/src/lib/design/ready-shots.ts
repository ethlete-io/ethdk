import { AddressInfo } from 'net';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { DesignConfig } from './paths';
import { ResolvedProduct } from './system/resolve-product';
import { sketchShowsNoChange } from './system/sketch/no-visible-change';
import { Sketch } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

/**
 * Shoots every state of every variant of the sketch and of the product's part on a render server of its own
 * (a free port), and says whether all of them match pixel for pixel. Any failure to shoot answers `false`.
 */
export const shotsShowNoChange = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
}): Promise<boolean> => {
  const { target, config, product, sketch } = options;
  let server: Awaited<ReturnType<typeof createDesignServer>> | undefined;

  try {
    server = await createDesignServer({ target, config, listen: true, port: 0 });
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const live = server;
    const shooter = createPartShooter({
      target,
      base: `http://localhost:${port}`,
      system: createSystemModules({ target, config }),
    });

    try {
      return await sketchShowsNoChange({
        product,
        sketch,
        pictureOf: shooter.pictureOf,
        load: ({ file, product: name, sketch: drawn }) =>
          live.ssrLoadModule(productModuleIdOf({ file, product: name, sketch: drawn })),
      });
    } finally {
      await shooter.close();
    }
  } catch {
    return false;
  } finally {
    await server?.close();
  }
};
