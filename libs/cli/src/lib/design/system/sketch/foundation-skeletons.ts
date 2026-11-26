import { colorsSkeletonOf } from './colors-skeleton';
import { logoSkeleton } from './logo-skeleton';

/** The files a new foundations part starts from: part files by name, and assets for the variant's `assets/` folder. */
export type FoundationSkeleton = { files: Record<string, string>; assets: Record<string, string> };

const SKELETONS: Record<string, FoundationSkeleton> = {
  'foundations/colors': colorsSkeletonOf({ scheme: 'both' }),
  'foundations/logo': logoSkeleton(),
};

/**
 * The fixed start of a new foundations part a sketch opens without a part to copy: structure and token names with
 * placeholder values, never a look. `null` for a part that starts from the empty stub.
 */
export const foundationSkeletonOf = (partKey: string): FoundationSkeleton | null => SKELETONS[partKey] ?? null;
