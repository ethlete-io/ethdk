import { ListedSketch } from '../../host/design';
import { SketchAddedSkip } from '../design-parts/sketches/sketches.component';

export const addedSkipsByVariant = (skips: NonNullable<ListedSketch['addedSkips']>) =>
  skips.reduce<Record<string, SketchAddedSkip[]>>(
    (byVariant, { variant, part, classes }) => ({
      ...byVariant,
      [variant]: [...(byVariant[variant] ?? []), { part, classes }],
    }),
    {},
  );
