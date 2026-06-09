import { Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';
import { GridComponentRegistration } from './grid.types';

export type GridConfig = {
  registrations: GridComponentRegistration[];
  invalidStateComponent?: Type<unknown>;
  interactiveAriaLabel: string;
  readonlyAriaLabel: string;
  dragHandleAriaLabel: string;
  transformer: (text: string, locale: string) => string;
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  registrations: [],
  interactiveAriaLabel: 'Interactive grid layout',
  readonlyAriaLabel: 'Grid layout',
  dragHandleAriaLabel: 'Drag to reorder',
  transformer: (text) => text,
};

export const [provideGridConfig, injectGridConfig] = createStaticRootProvider(DEFAULT_GRID_CONFIG, {
  name: 'GridConfig',
});
