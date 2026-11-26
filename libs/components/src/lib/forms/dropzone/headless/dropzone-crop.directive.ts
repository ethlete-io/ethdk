import { computed, Directive, effect, inject, input, signal } from '@angular/core';
import { injectHostElement, injectRenderer, RuntimeError } from '@ethlete/core';
import { DROPZONE_ERROR_CODES } from './dropzone-errors';
import {
  createInitialCropRect,
  cropRectForKey,
  dragCropCorner,
  DROPZONE_CROP_SHAPES,
  DropzoneCropConfig,
  DropzoneCropCorner,
  DropzoneCropRect,
  DropzoneCropSize,
  exportCroppedImage,
  moveCropRect,
} from './internals/dropzone-crop-math';

export { DROPZONE_CROP_SHAPES } from './internals/dropzone-crop-math';
export type {
  DropzoneCropConfig,
  DropzoneCropCorner,
  DropzoneCropRect,
  DropzoneCropShape,
} from './internals/dropzone-crop-math';

type CropDrag = {
  pointerId: number;
  corner: DropzoneCropCorner | null;
  startX: number;
  startY: number;
  startRect: DropzoneCropRect;
};

/**
 * Crop state for one image file: a rect in image pixels, aspect-locked when the config has an `aspectRatio` and free
 * otherwise, moved by `etDropzoneCropRect`, resized by `etDropzoneCropHandle` and by keyboard (arrows move, shift +
 * arrows resize). The host must have exactly the size of the rendered image and carries `data-shape`.
 */
@Directive({
  selector: '[etDropzoneCrop]',
  exportAs: 'etDropzoneCrop',
  host: {
    '(pointermove)': 'drag($event)',
    '(pointerup)': 'endDrag($event)',
    '(pointercancel)': 'endDrag($event)',
    '(keydown)': 'handleKeydown($event)',
    '[style]': 'rectVars()',
    '[attr.data-shape]': 'shape()',
  },
})
export class DropzoneCropDirective {
  private hostElement = injectHostElement();
  private renderer = injectRenderer();

  public file = input.required<File>();
  public config = input.required<DropzoneCropConfig>();

  private image = signal<HTMLImageElement | null>(null);
  private dragState: CropDrag | null = null;

  /** A `data:` URL of the file, `null` while it is read. */
  public imageSrc = signal<string | null>(null);
  public imageSize = computed<DropzoneCropSize | null>(() => {
    const image = this.image();

    return image ? { width: image.naturalWidth, height: image.naturalHeight } : null;
  });

  /** The crop in image pixels. `null` until the image is decoded. */
  public rect = signal<DropzoneCropRect | null>(null);

  /** The rect in percent of the image, for positioning the crop frame. */
  public rectPercent = computed(() => {
    const rect = this.rect();
    const size = this.imageSize();

    if (!rect || !size) return null;

    return {
      left: (rect.x / size.width) * 100,
      top: (rect.y / size.height) * 100,
      width: (rect.width / size.width) * 100,
      height: (rect.height / size.height) * 100,
    };
  });

  public ready = computed(() => this.rect() !== null);

  public shape = computed(() => this.config().shape ?? DROPZONE_CROP_SHAPES.RECT);

  protected rectVars = computed(() => {
    const rect = this.rectPercent();

    if (!rect) return null;

    return {
      '--_et-dropzone-crop-left': `${rect.left}%`,
      '--_et-dropzone-crop-top': `${rect.top}%`,
      '--_et-dropzone-crop-right': `${rect.left + rect.width}%`,
      '--_et-dropzone-crop-bottom': `${rect.top + rect.height}%`,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const file = this.file();
      const reader = new FileReader();
      const image = new Image();

      this.image.set(null);
      this.rect.set(null);
      this.imageSrc.set(null);

      image.onload = () => {
        this.image.set(image);
      };
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : null;

        this.imageSrc.set(src);
        if (src) image.src = src;
      };
      reader.readAsDataURL(file);

      onCleanup(() => {
        reader.onload = null;
        image.onload = null;
      });
    });

    effect(() => {
      const aspectRatio = this.config().aspectRatio;
      const size = this.imageSize();

      if (size) this.rect.set(createInitialCropRect(size, aspectRatio));
    });
  }

  /** Renders the current crop into a new `File`. Rejects while the image is not decoded yet. */
  public export() {
    const image = this.image();
    const rect = this.rect();

    if (!image || !rect)
      return Promise.reject(
        new RuntimeError(DROPZONE_ERROR_CODES.CROP_EXPORT_FAILED, '[DropzoneCrop] The image is not loaded yet.'),
      );

    return exportCroppedImage({
      image,
      rect,
      config: this.config(),
      file: this.file(),
      canvas: this.renderer.createElement('canvas'),
    });
  }

  /** @internal */
  public startDrag(event: PointerEvent, corner: DropzoneCropCorner | null) {
    const rect = this.rect();

    if (!rect || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    this.hostElement.setPointerCapture?.(event.pointerId);
    this.dragState = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startRect: rect,
    };
  }

  protected drag(event: PointerEvent) {
    const state = this.dragState;
    const size = this.imageSize();

    if (!state || !size || event.pointerId !== state.pointerId) return;

    const scale = size.width / (this.hostElement.getBoundingClientRect().width || size.width);
    const dx = (event.clientX - state.startX) * scale;
    const dy = (event.clientY - state.startY) * scale;
    this.rect.set(
      state.corner
        ? dragCropCorner({
            rect: state.startRect,
            corner: state.corner,
            dx,
            dy,
            aspectRatio: this.config().aspectRatio,
            image: size,
          })
        : moveCropRect({ rect: state.startRect, delta: { x: dx, y: dy }, image: size }),
    );
  }

  protected endDrag(event: PointerEvent) {
    if (this.dragState?.pointerId === event.pointerId) this.dragState = null;
  }

  protected handleKeydown(event: KeyboardEvent) {
    const rect = this.rect();
    const image = this.imageSize();

    if (!rect || !image) return;

    const next = cropRectForKey({
      rect,
      key: event.key,
      shiftKey: event.shiftKey,
      aspectRatio: this.config().aspectRatio,
      image,
    });

    if (!next) return;

    event.preventDefault();
    this.rect.set(next);
  }
}

/**
 * The crop frame: starts a move on pointer down and takes keyboard focus. Position it with the
 * `--_et-dropzone-crop-{left,top,right,bottom}` percentages the crop host sets.
 */
@Directive({
  selector: '[etDropzoneCropRect]',
  host: {
    tabindex: '0',
    '[style.display]': 'crop.ready() ? null : "none"',
    '(pointerdown)': 'crop.startDrag($event, null)',
  },
})
export class DropzoneCropRectDirective {
  protected crop = inject(DropzoneCropDirective);
}

/** A resize handle on one corner of the crop frame. */
@Directive({
  selector: '[etDropzoneCropHandle]',
  host: {
    '[attr.data-corner]': 'corner()',
    '(pointerdown)': 'crop.startDrag($event, corner())',
  },
})
export class DropzoneCropHandleDirective {
  protected crop = inject(DropzoneCropDirective);

  public corner = input.required<DropzoneCropCorner>({ alias: 'etDropzoneCropHandle' });
}
