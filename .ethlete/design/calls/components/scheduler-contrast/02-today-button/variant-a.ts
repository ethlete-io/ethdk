import { drawing } from '@design-explore';
import { frameStyles, INK, sheet } from './fixture';

export default drawing({
  body: sheet({
    code: `// surface-themes.ts
{
  name: 'light',
  semanticColorThemes: {
    default: 'brand-on-light',
    error: 'danger-on-light',
    success: 'success-on-light',
  },
}`,
    light: INK.brandOnLight,
    dark: INK.brand,
  }),
  styles: frameStyles,
});
