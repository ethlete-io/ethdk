import { ComponentType } from '@angular/cdk/portal';
import {
  ContentfulAudioComponent,
  ContentfulFileComponent,
  ContentfulImageComponent,
  ContentfulVideoComponent,
} from '../components';
import { ContentfulAsset } from '../types';

type ComponentLikeWithAsset = ComponentType<{ data: ContentfulAsset | null | undefined }>;

export interface ContentfulAssetComponents {
  file: ComponentLikeWithAsset;
  image: ComponentLikeWithAsset;
  video: ComponentLikeWithAsset;
  audio: ComponentLikeWithAsset;
}

export class ContentfulConfig {
  /**
   * Default components for rendering contentful assets
   */
  components?: Partial<ContentfulAssetComponents> = {
    file: ContentfulFileComponent,
    image: ContentfulImageComponent,
    video: ContentfulVideoComponent,
    audio: ContentfulAudioComponent,
  };

  /**
   * Component for rendering embedded entries
   */
  customComponents?: Record<string, ComponentType<unknown>>;

  /**
   * Determines if the contentful rich text renderer should render the contentful rich text with tailwind css classes
   */
  useTailwindClasses = false;
}
