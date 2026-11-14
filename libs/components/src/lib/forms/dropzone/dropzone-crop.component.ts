import { Component, DestroyRef, inject, input, output, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize, tap } from 'rxjs';
import { ButtonComponent } from '../../button/button.component';
import { FocusRingDirective } from '../../focus-ring/focus-ring.directive';
import {
  DropzoneCropConfig,
  DropzoneCropDirective,
  DropzoneCropHandleDirective,
  DropzoneCropRectDirective,
} from './headless/dropzone-crop.directive';

/** The default crop step of `et-dropzone`: the image with an aspect-locked crop frame, cancel and confirm. */
@Component({
  selector: 'et-dropzone-crop',
  templateUrl: './dropzone-crop.component.html',
  styleUrl: './dropzone-crop.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ButtonComponent,
    DropzoneCropDirective,
    DropzoneCropHandleDirective,
    DropzoneCropRectDirective,
    FocusRingDirective,
  ],
  host: {
    class: 'et-dropzone-crop',
  },
})
export class DropzoneCropComponent {
  private destroyRef = inject(DestroyRef);

  public file = input.required<File>();
  public config = input.required<DropzoneCropConfig>();
  public areaLabel = input('');
  public confirmLabel = input('');
  public cancelLabel = input('');
  public disabled = input(false);

  /** Emits the cropped file. */
  public cropConfirm = output<File>();
  public cropCancel = output<void>();

  protected exporting = signal(false);

  protected confirmCrop(crop: DropzoneCropDirective) {
    if (this.exporting()) return;

    this.exporting.set(true);

    defer(() => crop.export())
      .pipe(
        tap((file) => this.cropConfirm.emit(file)),
        finalize(() => this.exporting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
