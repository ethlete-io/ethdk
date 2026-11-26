import { drawing } from '@design-explore';
import { frameStyles, INK, sheet } from './fixture';

export default drawing({
  body: sheet({
    code: `<!-- scheduler.component.html -->
<button etButton etProvideColor="surface" variant="outline">
  Today
</button>`,
    light: INK.lightText,
    dark: INK.darkText,
  }),
  styles: frameStyles,
});
