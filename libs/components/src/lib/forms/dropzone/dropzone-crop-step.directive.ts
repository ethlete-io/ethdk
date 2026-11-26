import { Component, Directive, inject, ViewEncapsulation } from '@angular/core';
import { DropzoneCropComponent } from './dropzone-crop.component';
import { DROPZONE_CROP_STEP_TOKEN } from './dropzone-crop-step.token';
import { DropzoneComponent } from './dropzone.component';
import { DropzoneDirective } from './headless/dropzone.directive';

/** @internal */
@Component({
  selector: 'et-dropzone-crop-step',
  template: `
    @if (dropzoneDir.crop(); as crop) {
      @if (dropzoneDir.pendingCrops()[0]; as pending) {
        <et-dropzone-crop
          [file]="pending.file"
          [config]="crop"
          [disabled]="!dropzoneDir.interactive()"
          [areaLabel]="dropzone.resolvedLabels().cropArea"
          [confirmLabel]="dropzone.resolvedLabels().cropConfirm"
          [cancelLabel]="dropzone.resolvedLabels().cropCancel"
          (cropConfirm)="dropzoneDir.confirmCrop(pending.id, $event)"
          (cropCancel)="dropzoneDir.cancelCrop(pending.id)"
        />
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DropzoneCropComponent],
  host: {
    class: 'et-dropzone-crop-step',
  },
})
export class DropzoneCropStepComponent {
  protected dropzone = inject(DropzoneComponent);
  protected dropzoneDir = inject(DropzoneDirective);
}

/**
 * Turns on the crop step of `et-dropzone`: with it imported, `<et-dropzone [crop]="{ aspectRatio: 1 }">` sends
 * picked images through the crop step before they upload. Import it via `DROPZONE_CROP_IMPORTS`.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- matches the crop input of et-dropzone, which it does not own
  selector: 'et-dropzone[crop]',
  providers: [{ provide: DROPZONE_CROP_STEP_TOKEN, useValue: DropzoneCropStepComponent }],
})
export class DropzoneCropStepDirective {}
