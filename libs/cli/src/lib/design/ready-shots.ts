import { createPartShooter } from './shot';
import { DesignConfig } from './paths';
import { ResolvedProduct } from './system/resolve-product';
import { aktuellPlaceholderWarningsOf } from './system/sketch/aktuell-placeholders';
import { IdenticalRender, identicalRendersOf } from './system/sketch/identical-renders';
import { variantChangesOf, variantLoadProblemsOf } from './system/sketch/no-visible-change';
import { sampleMarkDriftLinesOf } from './system/sketch/sample-mark-drift';
import { Sketch } from './system/sketch/sketch';
import { VariantChange } from './system/sketch/viewed-shots';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';
import { DesignServer, Drawing, drawingOn, loadingOn, WarmDraw } from './warm-draw';

type SketchShots = {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  warm?: WarmDraw;
};

const loaderOf =
  (server: DesignServer) =>
  ({ file, product, sketch }: { file: string; product: string; sketch: SketchVariant | null }) =>
    server.ssrLoadModule(productModuleIdOf({ file, product, sketch }));

const shooterOf = (options: SketchShots, { base, queue }: Drawing) =>
  createPartShooter({
    target: options.target,
    base,
    system: createSystemModules({ target: options.target, config: options.config }),
    queue,
  });

const couldNotRender = (sketch: Sketch, error: unknown) =>
  `could not render ${sketch.target}: ${error instanceof Error ? error.message : String(error)}`;

/** Loads each target of each live variant of the sketch on a render server; why each one fails to load. */
export const variantsThatDoNotLoad = async (options: SketchShots): Promise<string[]> => {
  try {
    return await loadingOn(options, (server) =>
      variantLoadProblemsOf({ product: options.product, sketch: options.sketch, load: loaderOf(server) }),
    );
  } catch (error) {
    return [`the variants failed to load: ${error instanceof Error ? error.message : String(error)}`];
  }
};

/** Renders each target of each live variant on a render server; see `sampleMarkDriftLinesOf`. */
export const sampleMarkDriftLines = async (options: SketchShots): Promise<string[]> => {
  try {
    return await loadingOn(options, (server) =>
      sampleMarkDriftLinesOf({ product: options.product, sketch: options.sketch, load: loaderOf(server) }),
    );
  } catch (error) {
    return [couldNotRender(options.sketch, error)];
  }
};

/**
 * Shoots every state of every variant of the sketch and of the product's part on a render server. What each live
 * variant draws differently, `null` when it matches pixel for pixel; a failure to shoot answers why.
 */
export const variantChangesShown = async (options: SketchShots): Promise<VariantChange[] | string> => {
  try {
    return await drawingOn(options, (drawing) =>
      variantChangesOf({
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooterOf(options, drawing).pictureOf,
        load: loaderOf(drawing.server),
      }),
    );
  } catch (error) {
    return `the shots failed: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/** Shoots the sketch on a render server; one warning per target part whose "Aktuell" column shows only placeholders. */
export const aktuellPlaceholderWarnings = async (options: SketchShots): Promise<string[]> => {
  try {
    return await drawingOn(options, (drawing) =>
      aktuellPlaceholderWarningsOf({
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooterOf(options, drawing).pictureOf,
        load: loaderOf(drawing.server),
      }),
    );
  } catch (error) {
    return [`ready will refuse: ${couldNotRender(options.sketch, error)}`];
  }
};

/** Shoots the sketch on a render server; one line per live variant that adds nothing visible, see `identicalRenderLinesOf`. */
export const identicalRenderLines = async (options: SketchShots): Promise<string[]> =>
  (await identicalRenders(options)).map((render) => render.line);

/** Shoots the sketch like `identicalRenderLines`, and says which sibling each named variant draws like. */
export const identicalRenders = async (options: SketchShots): Promise<IdenticalRender[]> => {
  try {
    return await drawingOn(options, (drawing) => {
      const shooter = shooterOf(options, drawing);

      return identicalRendersOf({
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooter.pictureOf,
        boxOf: shooter.changedBoxesOf,
        load: loaderOf(drawing.server),
      });
    });
  } catch (error) {
    return [{ variant: '', sibling: null, line: couldNotRender(options.sketch, error) }];
  }
};
