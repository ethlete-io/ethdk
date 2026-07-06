import { createStaticRootProvider } from '@ethlete/core';
import { GridComponentRegistration, GridItemActionsComponent } from './grid.types';

export type GridConfig = {
  registrations: GridComponentRegistration[];
  interactiveAriaLabel: string;
  readonlyAriaLabel: string;
  removeActionAriaLabel: string;
  transformer: (text: string, locale: string) => string;
  actionsComponent?: GridItemActionsComponent | null;
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  registrations: [],
  interactiveAriaLabel: 'Interactive grid layout',
  readonlyAriaLabel: 'Grid layout',
  removeActionAriaLabel: 'Remove item',
  transformer: (text) => text,
};

export const [provideGridConfig, injectGridConfig] = createStaticRootProvider(DEFAULT_GRID_CONFIG, {
  name: 'GridConfig',
});
