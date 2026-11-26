import { DropzoneCropStepDirective } from './dropzone-crop-step.directive';
import { DropzoneComponent } from './dropzone.component';
import { DropzoneDirective } from './headless/dropzone.directive';

export const DROPZONE_IMPORTS = [DropzoneComponent, DropzoneDirective] as const;

export const DROPZONE_CROP_IMPORTS = [DropzoneCropStepDirective] as const;
