import { SeoConfig } from './seo.directive.types';

export const mergeSeoConfig = (config: SeoConfig, parentConfig: SeoConfig): SeoConfig => {
  return {
    ...parentConfig,
    ...config,
  };
};
