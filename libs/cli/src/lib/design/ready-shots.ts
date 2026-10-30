import { AddressInfo } from 'net';
import { createDesignServer } from './serve';
import { createPartShooter } from './shot';
import { DesignConfig } from './paths';
import { ResolvedProduct } from './system/resolve-product';
import { sketchShowsNoChange, variantLoadProblemsOf } from './system/sketch/no-visible-change';
import { Sketch } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

/** Loads each target of each live variant of the sketch on a render server of its own; why each one fails to load. */
export const variantsThatDoNotLoad = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
}): Promise<string[]> => {
  const { target, config, product, sketch } = options;
  let server: Awaited<ReturnType<typeof createDesignServer>> | undefined;

  try {
    const live = await createDesignServer({ target, config, listen: false });

    server = live;

    return await variantLoadProblemsOf({
      product,
      sketch,
      load: ({ file, product: name, sketch: drawn }) =>
        live.ssrLoadModule(productModuleIdOf({ file, product: name, sketch: drawn })),
    });
  } catch (error) {
    return [`the variants failed to load: ${error instanceof Error ? error.message : String(error)}`];
  } finally {
    await server?.close();
  }
};

/**
 * Shoots every state of every variant of the sketch and of the product's part on a render server of its own
 * (a free port). `true` when all of them match pixel for pixel; otherwise why not, a failure to shoot included.
 */
export const shotsShowNoChange = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
}): Promise<true | string> => {
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
  } catch (error) {
    return `the shots failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    await server?.close();
  }
};
