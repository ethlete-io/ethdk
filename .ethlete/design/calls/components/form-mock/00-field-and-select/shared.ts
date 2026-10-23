import { themeCss } from '@ethlete/core/design/theme-css';
import { css } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from './fixture';

export const frameStyles = (componentStyles: string) => css`
  ${themeCss({ surfaceThemes: SURFACE_THEMES, colorThemes: COLOR_THEMES })}
  ${componentStyles}
  :root {
    font-size: 62.5%;
  }
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
    font-size: 1.4rem;
  }
  .panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    padding: 24px;
    background: var(--et-surface-background-solid);
    color: var(--et-surface-color-solid);
  }
`;
