import { RuntimeError } from '@ethlete/core';
import { DROPZONE_ERROR_CODES } from '../dropzone-errors';

export const DROPZONE_CROP_SHAPES = {
  RECT: 'rect',
  ROUND: 'round',
} as const;

export type DropzoneCropShape = (typeof DROPZONE_CROP_SHAPES)[keyof typeof DROPZONE_CROP_SHAPES];

export type DropzoneCropConfig = {
  /** Width divided by height of the crop, e.g. `1` for a square or `16 / 9`. Leave it out for a free crop. */
  aspectRatio?: number;
  /**
   * Shape of the crop frame. `'round'` shows a circle, or an ellipse without a square aspect ratio. The cropped
   * file is always the rectangle around it. @default 'rect'
   */
  shape?: DropzoneCropShape;
  /** Scales the cropped image down to at most this many pixels wide. */
  maxWidth?: number;
  /** Scales the cropped image down to at most this many pixels high. */
  maxHeight?: number;
  /** MIME type of the cropped file. Defaults to the picked file's type, or `image/png` when canvas cannot encode it. */
  type?: string;
  /** Encoder quality from 0 to 1 for lossy types. @default 0.92 */
  quality?: number;
};

export type DropzoneCropRect = { x: number; y: number; width: number; height: number };

export type DropzoneCropSize = { width: number; height: number };

export type DropzoneCropCorner = 'nw' | 'ne' | 'sw' | 'se';

export const DROPZONE_CROP_MIN_SIZE = 16;

const ENCODABLE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const clamp = (value: number, [min, max]: [number, number]) => Math.min(Math.max(value, min), max);

export const isDropzoneCroppableFile = (file: File) => file.type.startsWith('image/') && file.type !== 'image/svg+xml';

export const createInitialCropRect = (image: DropzoneCropSize, aspectRatio?: number): DropzoneCropRect => {
  if (aspectRatio === undefined) return { x: 0, y: 0, width: image.width, height: image.height };

  const width = Math.min(image.width, image.height * aspectRatio);
  const height = width / aspectRatio;

  return { x: (image.width - width) / 2, y: (image.height - height) / 2, width, height };
};

export type MoveCropRectOptions = {
  rect: DropzoneCropRect;
  delta: { x: number; y: number };
  image: DropzoneCropSize;
};

export const moveCropRect = ({ rect, delta, image }: MoveCropRectOptions): DropzoneCropRect => ({
  ...rect,
  x: clamp(rect.x + delta.x, [0, image.width - rect.width]),
  y: clamp(rect.y + delta.y, [0, image.height - rect.height]),
});

export type ResizeCropRectOptions = {
  rect: DropzoneCropRect;
  corner: DropzoneCropCorner;
  /** Change of the width in image pixels; the height follows the aspect ratio. */
  delta: number;
  aspectRatio: number;
  image: DropzoneCropSize;
  minWidth?: number;
};

export const resizeCropRect = (options: ResizeCropRectOptions): DropzoneCropRect => {
  const { rect, corner, delta, aspectRatio, image, minWidth = DROPZONE_CROP_MIN_SIZE } = options;
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? rect.x + rect.width : rect.x;
  const anchorY = north ? rect.y + rect.height : rect.y;
  const maxWidth = Math.min(
    west ? anchorX : image.width - anchorX,
    (north ? anchorY : image.height - anchorY) * aspectRatio,
  );
  const width = clamp(rect.width + delta, [Math.min(minWidth, maxWidth), maxWidth]);
  const height = width / aspectRatio;

  return { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height };
};

export type ResizeFreeCropRectOptions = {
  rect: DropzoneCropRect;
  corner: DropzoneCropCorner;
  delta: { x: number; y: number };
  image: DropzoneCropSize;
  minSize?: number;
};

export const resizeFreeCropRect = (options: ResizeFreeCropRectOptions): DropzoneCropRect => {
  const { rect, corner, delta, image, minSize = DROPZONE_CROP_MIN_SIZE } = options;
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const anchorX = west ? rect.x + rect.width : rect.x;
  const anchorY = north ? rect.y + rect.height : rect.y;
  const maxWidth = west ? anchorX : image.width - anchorX;
  const maxHeight = north ? anchorY : image.height - anchorY;
  const width = clamp(rect.width + (west ? -delta.x : delta.x), [Math.min(minSize, maxWidth), maxWidth]);
  const height = clamp(rect.height + (north ? -delta.y : delta.y), [Math.min(minSize, maxHeight), maxHeight]);

  return { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height };
};

export type DragCropCornerOptions = {
  rect: DropzoneCropRect;
  corner: DropzoneCropCorner;
  dx: number;
  dy: number;
  aspectRatio: number | undefined;
  image: DropzoneCropSize;
};

export const dragCropCorner = ({ rect, corner, dx, dy, aspectRatio, image }: DragCropCornerOptions) =>
  aspectRatio === undefined
    ? resizeFreeCropRect({ rect, corner, delta: { x: dx, y: dy }, image })
    : resizeCropRect({ rect, corner, delta: cornerDragDelta({ corner, dx, dy, aspectRatio }), aspectRatio, image });

export type CornerDragDeltaOptions = { corner: DropzoneCropCorner; dx: number; dy: number; aspectRatio: number };

export const cornerDragDelta = ({ corner, dx, dy, aspectRatio }: CornerDragDeltaOptions) => {
  const sx = corner === 'nw' || corner === 'sw' ? -1 : 1;
  const sy = corner === 'nw' || corner === 'ne' ? -1 : 1;

  return (sx * dx + sy * dy * aspectRatio) / 2;
};

export type CropRectForKeyOptions = {
  rect: DropzoneCropRect;
  key: string;
  shiftKey: boolean;
  aspectRatio: number | undefined;
  image: DropzoneCropSize;
};

export const cropRectForKey = (options: CropRectForKeyOptions): DropzoneCropRect | null => {
  const { rect, key, shiftKey, aspectRatio, image } = options;
  const step = Math.max(1, Math.round(Math.max(image.width, image.height) / 100));
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = directions[key];

  if (!direction) return null;

  const [x, y] = direction;

  if (shiftKey) {
    return aspectRatio === undefined
      ? resizeFreeCropRect({ rect, corner: 'se', delta: { x: x * step, y: y * step }, image })
      : resizeCropRect({ rect, corner: 'se', delta: (x + y) * step, aspectRatio, image });
  }

  return moveCropRect({ rect, delta: { x: x * step, y: y * step }, image });
};

export const cropOutputSize = (rect: DropzoneCropRect, config: DropzoneCropConfig): DropzoneCropSize => {
  const scale = Math.min(1, (config.maxWidth ?? Infinity) / rect.width, (config.maxHeight ?? Infinity) / rect.height);

  return { width: Math.max(1, Math.round(rect.width * scale)), height: Math.max(1, Math.round(rect.height * scale)) };
};

export const cropOutputType = (file: File, config: DropzoneCropConfig) =>
  config.type ?? (ENCODABLE_TYPES.includes(file.type) ? file.type : 'image/png');

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const cropFileName = ({ name, sourceType, type }: { name: string; sourceType: string; type: string }) => {
  const extension = EXTENSIONS[type];

  if (type === sourceType || !extension) return name;

  const dot = name.lastIndexOf('.');

  return `${dot > 0 ? name.slice(0, dot) : name}.${extension}`;
};

export type ExportCroppedImageOptions = {
  image: CanvasImageSource;
  rect: DropzoneCropRect;
  config: DropzoneCropConfig;
  file: File;
  canvas: HTMLCanvasElement;
};

export const exportCroppedImage = (options: ExportCroppedImageOptions) => {
  const { image, rect, config, file, canvas } = options;
  const { width, height } = cropOutputSize(rect, config);
  const type = cropOutputType(file, config);
  const context = canvas.getContext('2d');

  if (!context) {
    return Promise.reject(
      new RuntimeError(DROPZONE_ERROR_CODES.CROP_EXPORT_FAILED, '[DropzoneCrop] Canvas 2d context is not available.'),
    );
  }

  canvas.width = width;
  canvas.height = height;

  if (type === 'image/jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new RuntimeError(DROPZONE_ERROR_CODES.CROP_EXPORT_FAILED, '[DropzoneCrop] Canvas produced no image.'));

          return;
        }

        resolve(
          new File([blob], cropFileName({ name: file.name, sourceType: file.type, type: blob.type || type }), {
            type: blob.type || type,
          }),
        );
      },
      type,
      config.quality ?? 0.92,
    );
  });
};
