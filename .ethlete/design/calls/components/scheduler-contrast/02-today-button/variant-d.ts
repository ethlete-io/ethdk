import { drawing } from '@design-explore';
import { frameStyles, INK, sheet } from './fixture';

export default drawing({
  body: sheet({
    code: `<!-- scheduler.stories.ts, LightSurface -->
<div etProvideSurface="light" etProvideColor="brand-on-light">
  <et-scheduler ... />
</div>`,
    light: INK.brandOnLight,
    dark: INK.brand,
  }),
  styles: frameStyles,
});
