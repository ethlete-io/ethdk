import { couldNotRenderText } from './failure-line';
import { createPartShooter } from './shot';
import { DesignConfig } from './design-config';
import { ResolvedProduct } from './system/resolve-product';
import { aktuellPlaceholderWarningsOf } from './system/sketch/aktuell-placeholders';
import {
  IdenticalRender,
  identicalRendersOf,
  refusingRendersOf,
  sketchRendersOf,
} from './system/sketch/identical-renders';
import { variantChangesOf, variantLoadProblemsOf } from './system/sketch/no-visible-change';
import { Problem } from './system/problem';
import { noVisibleChangeProblemsOf } from './system/rules/no-visible-change';
import { restLikeStateWarningsOf } from './system/sketch/rest-like-states';
import { textOnlyStateWarningsOf } from './system/sketch/text-only-states';
import { sampleMarkDriftLinesOf } from './system/sketch/sample-mark-drift';
import { samePictureStateWarningsOf } from './system/sketch/same-picture-states';
import { weakStateWarningsOf } from './system/sketch/weak-states';
import { duplicatedTitleWarningsOf } from './system/sketch/duplicated-title';
import { imageTextWarningsOf } from './system/sketch/image-text';
import { unknownThemeWarningsOf } from './system/sketch/unknown-theme';
import { Sketch } from './system/sketch/sketch';
import { stateInnerLinesOf } from './system/sketch/state-inner-lines';
import { interactionRepeatLinesOf } from './system/sketch/interaction-repeat-lines';
import { VariantChange } from './system/sketch/viewed-shots';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';
import { DesignServer, Drawing, drawingOn, loadingOn, WarmDraw } from './warm-draw';
import { studioListWidthOf } from './studio-list-width';

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

const runShooters = new WeakMap<WarmDraw, ReturnType<typeof createPartShooter>>();

const shooterOf = (options: SketchShots, { base, queue }: Drawing) => {
  const kept = options.warm?.perRun ? runShooters.get(options.warm) : undefined;
  const shooter =
    kept ??
    createPartShooter({
      target: options.target,
      base,
      system: createSystemModules({ target: options.target, config: options.config }),
      queue,
    });

  if (options.warm?.perRun) runShooters.set(options.warm, shooter);

  return shooter;
};

const couldNotRender = (sketch: Sketch, error: unknown) =>
  couldNotRenderText(sketch.target, error instanceof Error ? error.message : String(error));

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

/** Renders each target of each live variant on a render server; see `stateInnerLinesOf`. */
export const stateInnerLines = async (options: SketchShots): Promise<string[]> => {
  try {
    return await loadingOn(options, (server) =>
      stateInnerLinesOf({ product: options.product, sketch: options.sketch, load: loaderOf(server) }),
    );
  } catch (error) {
    return [couldNotRender(options.sketch, error)];
  }
};

/** Renders each target of each live variant on a render server; see `interactionRepeatLinesOf`. */
export const interactionRepeatLines = async (options: SketchShots): Promise<string[]> => {
  try {
    return await loadingOn(options, (server) =>
      interactionRepeatLinesOf({ product: options.product, sketch: options.sketch, load: loaderOf(server) }),
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

/**
 * Shoots the sketch on a render server; one warning per state that draws like its rest state, see `restLikeStateWarningsOf`,
 * one per state that barely differs from it, see `weakStateWarningsOf`, one per pair of states that render the same
 * picture, see `samePictureStateWarningsOf`, one per group of states that differ only in their text, see
 * `textOnlyStateWarningsOf`, one per target with text that does not read, see `imageTextWarningsOf`, and one per target that draws a title next to an image marked as carrying it, see `duplicatedTitleWarningsOf`, and one per target that uses a colour theme no foundation defines, see `unknownThemeWarningsOf`.
 */
export const restLikeStateWarnings = async (options: SketchShots): Promise<string[]> => {
  try {
    return await drawingOn(options, async (drawing) => {
      const shared = {
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooterOf(options, drawing).pictureOf,
        load: loaderOf(drawing.server),
      };

      return [
        ...(await restLikeStateWarningsOf(shared)),
        ...(await weakStateWarningsOf(shared)),
        ...(await samePictureStateWarningsOf(shared)),
        ...(await textOnlyStateWarningsOf(shared)),
        ...(await imageTextWarningsOf(shared)),
        ...(await duplicatedTitleWarningsOf(shared)),
        ...(await unknownThemeWarningsOf(shared)),
      ];
    });
  } catch (error) {
    return [couldNotRender(options.sketch, error)];
  }
};

/** Shoots the sketch on a render server; see `weakStateWarningsOf` and `samePictureStateWarningsOf`. */
export const weakStateWarnings = async (options: SketchShots): Promise<string[]> => {
  try {
    return await drawingOn(options, async (drawing) => {
      const shared = {
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooterOf(options, drawing).pictureOf,
        load: loaderOf(drawing.server),
      };

      return [...(await weakStateWarningsOf(shared)), ...(await samePictureStateWarningsOf(shared))];
    });
  } catch (error) {
    return [couldNotRender(options.sketch, error)];
  }
};

/**
 * Shoots the sketch on a render server; one line per live variant that adds nothing visible, see
 * `identicalRenderLinesOf`, and one per pair of variants that look alike in a state their round asks, see `alikePairLinesOf`.
 */
export const identicalRenderLines = async (options: SketchShots): Promise<string[]> => {
  try {
    const renders = await drawingOn(options, (drawing) => {
      const shooter = shooterOf(options, drawing);

      return sketchRendersOf({
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooter.pictureOf,
        boxOf: shooter.changedBoxesOf,
        load: loaderOf(drawing.server),
      });
    });

    return [...refusingRendersOf(options.sketch, renders.identical).map((render) => render.line), ...renders.alike];
  } catch (error) {
    return [couldNotRender(options.sketch, error)];
  }
};

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
    return [{ variant: '', sibling: null, everyState: false, line: couldNotRender(options.sketch, error) }];
  }
};

/** Shoots the sketch once; the lines of `identicalRenderLines` and the warnings of `lookAlikeWarningsOf`. */
export const sketchRenderLines = async (options: SketchShots): Promise<{ refusals: string[]; warnings: string[] }> => {
  try {
    const renders = await drawingOn(options, (drawing) => {
      const shooter = shooterOf(options, drawing);

      return sketchRendersOf({
        product: options.product,
        sketch: options.sketch,
        pictureOf: shooter.pictureOf,
        boxOf: shooter.changedBoxesOf,
        load: loaderOf(drawing.server),
        lookAlike: true,
        listWidth: studioListWidthOf(options.target) ?? undefined,
      });
    });

    return {
      refusals: [
        ...refusingRendersOf(options.sketch, renders.identical).map((render) => render.line),
        ...renders.alike,
      ],
      warnings: renders.lookAlike,
    };
  } catch (error) {
    return { refusals: [couldNotRender(options.sketch, error)], warnings: [] };
  }
};

/** Shoots the sketch on a render server; the `NO-VISIBLE-CHANGE` problems of its part, see `noVisibleChangeProblemsOf`. */
export const noVisibleChangeProblems = async (options: SketchShots): Promise<Problem[]> =>
  drawingOn(options, (drawing) =>
    noVisibleChangeProblemsOf({
      product: options.product,
      sketch: options.sketch,
      pictureOf: shooterOf(options, drawing).pictureOf,
      load: loaderOf(drawing.server),
    }),
  );
