/// <reference types="vite/client" />
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';

const modules = /* @__PURE__ */ import.meta.glob<Record<string, unknown>>(
  ['../src/lib/icon/headless/*-icon.ts', '../src/lib/icon/headless/*-icons.ts'],
  { eager: true },
);

const isIconDefinition = (value: unknown): value is IconDefinition =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as IconDefinition).name === 'string' &&
  typeof (value as IconDefinition).data === 'string';

/** Every icon the SDK ships, read from the icon source files and sorted by name. */
export const SDK_ICONS: readonly IconDefinition[] = /* @__PURE__ */ Object.values(modules)
  .flatMap((module) => Object.values(module))
  .filter(isIconDefinition)
  .sort((a, b) => a.name.localeCompare(b.name));
