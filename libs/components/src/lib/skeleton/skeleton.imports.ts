import { SkeletonItemComponent } from './skeleton-item.component';
import { SkeletonTextComponent } from './skeleton-text.component';
import { SkeletonComponent } from './skeleton.component';

/** The skeleton container, its shapes and the multi-line text helper. */
export const SKELETON_IMPORTS = [SkeletonComponent, SkeletonItemComponent, SkeletonTextComponent] as const;
