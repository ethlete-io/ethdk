import { createStaticRootProvider } from '@ethlete/core';
import { GridComponentRegistration, GridItemActionsComponent } from './grid.types';

export type GridConfig = {
  registrations: GridComponentRegistration[];
  actionsComponent?: GridItemActionsComponent | null;
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  registrations: [],
};

export const [provideGridConfig, injectGridConfig] = createStaticRootProvider(DEFAULT_GRID_CONFIG, {
  name: 'GridConfig',
});
