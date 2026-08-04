import { InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type IconDefinition = {
  name: string;
  data: string;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const ICONS_TOKEN = new InjectionToken<Record<string, IconDefinition>>('ET_ICONS_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
