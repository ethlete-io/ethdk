import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { GridComponentRegistration, GridItemActionsComponent } from './grid.types';

export type GridConfig = {
  registrations: GridComponentRegistration[];
  actionsComponent?: GridItemActionsComponent | null;
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  registrations: [],
};

const GRID_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider(DEFAULT_GRID_CONFIG, {
  name: 'GridConfig',
});

export const provideGridConfig = /* @__PURE__ */ toProvideFn(GRID_CONFIG_DEF);
export const injectGridConfig = /* @__PURE__ */ toInjectFn(GRID_CONFIG_DEF);
