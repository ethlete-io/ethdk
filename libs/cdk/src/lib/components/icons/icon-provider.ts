import { InjectionToken } from '@angular/core';

export type IconDefinition = {
  name: string;
  data: string;
};

export const ICONS_TOKEN = new InjectionToken<Record<string, IconDefinition>>('ET_ICONS_TOKEN');

export const provideIcons = (...icons: IconDefinition[]) => {
  const map: Record<string, IconDefinition> = {};

  for (const def of icons) {
    if (map[def.name]) {
      throw new Error(`Icon with name ${def.name} already exists. Please provide unique icon names.`);
    }

    map[def.name] = def;
  }

  return {
    provide: ICONS_TOKEN,
    useValue: map,
  };
};
