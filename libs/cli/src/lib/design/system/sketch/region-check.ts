import { DesignConfig } from '../../design-config';
import { ShootStates } from '../compare-command';
import { StartHarnessServer, withHarnessUrl } from '../harness-server';
import { liveSpecOf, shootLiveStates } from '../live-compare';
import { partFilesOf } from '../product';
import { Region, RegionDelta, regionDeltaLineOf, regionDeltasOf } from '../region-geometry';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partSelectorsOf } from '../uncovered-regions';
import { rejectionOf, Sketch, variantDirOf } from './sketch';

/** The parts a variant claims to change: the sketch's targets and every part file the variant holds. */
export const claimedPartsOf = (sketch: Sketch, variant: string) =>
  new Set([...sketch.targets, ...partFilesOf(variantDirOf(sketch, variant)).parts.map(partKeyOf)]);

const drawnBefore = (merged: Region[], delta: RegionDelta) => {
  const rect = merged.find((region) => region.name === delta.name)?.[delta.rect];

  return (
    rect !== undefined &&
    rect.x === delta.design.x &&
    rect.y === delta.design.y &&
    rect.width === delta.design.width &&
    rect.height === delta.design.height
  );
};

export type RegionCheck = { lines: string[]; notes: string[] };

/**
 * Compares, for each live variant of a page sketch whose page implements an app component and has live states, the
 * regions of every embedded part the variant does not claim against the live app: one `REGION` line per box or clip
 * the variant draws elsewhere than the app and than the merged design. `notes` says why a variant or state could not be checked.
 */
export const sketchRegionCheckOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  shoot?: ShootStates;
  start?: StartHarnessServer;
}): Promise<RegionCheck> => {
  const { target, config, product, sketch } = options;
  const part = partKeyOf(sketch);
  const none: RegionCheck = { lines: [], notes: [] };

  if (!part.startsWith('pages/') || !partSelectorsOf({ target, product }).some((entry) => entry.name === part))
    return none;

  const live = liveSpecOf({ target, product });

  if (typeof live === 'string' || !live.spec.pages[part]) return none;

  const variants = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const checked = await withHarnessUrl({
    target,
    product,
    url: undefined,
    start: options.start,
    run: async (url) => {
      const found: RegionCheck = { lines: [], notes: [] };
      const shootOf = (sketched: string | null) =>
        (options.shoot ?? shootLiveStates)({ target, config, product, part, url, only: null, sketch: sketched });
      const merged = await shootOf(null);
      const mergedRegionsOf = (state: string) => {
        const shot = typeof merged === 'string' ? undefined : merged.shots.find((entry) => entry.state === state);

        return shot && 'regions' in shot ? (shot.regions?.design ?? []) : [];
      };

      for (const variant of variants) {
        const shot = await shootOf(variant);

        if (typeof shot === 'string') {
          found.notes.push(`variant ${variant}: ${shot}`);
          continue;
        }

        const claimed = claimedPartsOf(sketch, variant);

        for (const state of shot.shots) {
          if ('problem' in state) {
            found.notes.push(`variant ${variant} ${state.state}: ${state.problem}`);
            continue;
          }

          const deltas = state.regions ? regionDeltasOf(state.regions) : [];
          const before = mergedRegionsOf(state.state);

          found.lines.push(
            ...deltas
              .filter((delta) => !claimed.has(delta.name) && !drawnBefore(before, delta))
              .map((delta) => `variant ${variant} ${state.state}: ${regionDeltaLineOf(delta)}`),
          );
        }
      }

      return found;
    },
  });

  return typeof checked === 'string' ? { lines: [], notes: [checked] } : checked;
};
