import { InjectionToken } from '@angular/core';
import { PictureConfig } from './picture.component.types';

export const IMAGE_CONFIG_TOKEN = new InjectionToken<PictureConfig>('IMAGE_CONFIG_TOKEN');

export const provideImageConfig = (config: Partial<PictureConfig> | null | undefined = {}) => {
  return {
    provide: IMAGE_CONFIG_TOKEN,
    useValue: config,
  };
};
