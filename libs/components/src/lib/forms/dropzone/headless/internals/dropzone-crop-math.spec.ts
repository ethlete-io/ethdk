import {
  cornerDragDelta,
  createInitialCropRect,
  cropFileName,
  cropOutputSize,
  cropOutputType,
  cropRectForKey,
  exportCroppedImage,
  isDropzoneCroppableFile,
  moveCropRect,
  resizeCropRect,
} from './dropzone-crop-math';

const IMAGE = { width: 400, height: 200 };

describe('dropzone crop math', () => {
  it('should start with the largest centered rect of the aspect ratio', () => {
    expect(createInitialCropRect(IMAGE, 1)).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    expect(createInitialCropRect(IMAGE, 4)).toEqual({ x: 0, y: 50, width: 400, height: 100 });
  });

  it('should clamp a move to the image', () => {
    const rect = { x: 100, y: 0, width: 200, height: 200 };

    expect(moveCropRect({ rect, delta: { x: 500, y: 30 }, image: IMAGE })).toEqual({ ...rect, x: 200, y: 0 });
    expect(moveCropRect({ rect, delta: { x: -150, y: 0 }, image: IMAGE })).toEqual({ ...rect, x: 0 });
  });

  it('should keep the aspect ratio and the opposite corner on resize', () => {
    const rect = { x: 100, y: 50, width: 100, height: 50 };

    const grown = resizeCropRect({ rect, corner: 'se', delta: 40, aspectRatio: 2, image: IMAGE });
    expect(grown).toEqual({ x: 100, y: 50, width: 140, height: 70 });

    const fromNorthWest = resizeCropRect({ rect, corner: 'nw', delta: 40, aspectRatio: 2, image: IMAGE });
    expect(fromNorthWest).toEqual({ x: 60, y: 30, width: 140, height: 70 });
  });

  it('should clamp a resize to the image and to the minimum size', () => {
    const rect = { x: 100, y: 50, width: 100, height: 50 };

    expect(resizeCropRect({ rect, corner: 'se', delta: 1000, aspectRatio: 2, image: IMAGE })).toEqual({
      x: 100,
      y: 50,
      width: 300,
      height: 150,
    });
    expect(resizeCropRect({ rect, corner: 'se', delta: -1000, aspectRatio: 2, image: IMAGE }).width).toBe(16);
  });

  it('should project a corner drag onto the width', () => {
    expect(cornerDragDelta({ corner: 'se', dx: 10, dy: 10, aspectRatio: 1 })).toBe(10);
    expect(cornerDragDelta({ corner: 'nw', dx: 10, dy: 10, aspectRatio: 1 })).toBe(-10);
    expect(cornerDragDelta({ corner: 'ne', dx: 10, dy: -10, aspectRatio: 1 })).toBe(10);
  });

  it('should move with arrows and resize with shift + arrows', () => {
    const rect = { x: 100, y: 0, width: 100, height: 100 };
    const options = { rect, aspectRatio: 1, image: IMAGE, shiftKey: false };

    expect(cropRectForKey({ ...options, key: 'ArrowRight' })).toEqual({ ...rect, x: 104 });
    expect(cropRectForKey({ ...options, key: 'ArrowUp' })).toEqual(rect);
    expect(cropRectForKey({ ...options, key: 'ArrowDown', shiftKey: true })).toEqual({
      ...rect,
      width: 104,
      height: 104,
    });
    expect(cropRectForKey({ ...options, key: 'ArrowLeft', shiftKey: true })).toEqual({
      ...rect,
      width: 96,
      height: 96,
    });
    expect(cropRectForKey({ ...options, key: 'Enter' })).toBeNull();
  });

  it('should scale the output down to the max size', () => {
    const rect = { x: 0, y: 0, width: 400, height: 200 };

    expect(cropOutputSize(rect, { aspectRatio: 2 })).toEqual({ width: 400, height: 200 });
    expect(cropOutputSize(rect, { aspectRatio: 2, maxWidth: 100 })).toEqual({ width: 100, height: 50 });
    expect(cropOutputSize(rect, { aspectRatio: 2, maxWidth: 300, maxHeight: 50 })).toEqual({ width: 100, height: 50 });
  });

  it('should pick an encodable type and match the file name to it', () => {
    const gif = new File([], 'cat.gif', { type: 'image/gif' });
    const jpeg = new File([], 'cat.jpeg', { type: 'image/jpeg' });

    expect(cropOutputType(gif, { aspectRatio: 1 })).toBe('image/png');
    expect(cropOutputType(jpeg, { aspectRatio: 1 })).toBe('image/jpeg');
    expect(cropOutputType(jpeg, { aspectRatio: 1, type: 'image/webp' })).toBe('image/webp');
    expect(cropFileName({ name: 'cat.jpeg', sourceType: 'image/jpeg', type: 'image/jpeg' })).toBe('cat.jpeg');
    expect(cropFileName({ name: 'cat.gif', sourceType: 'image/gif', type: 'image/png' })).toBe('cat.png');
  });

  it('should only crop raster images', () => {
    expect(isDropzoneCroppableFile(new File([], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isDropzoneCroppableFile(new File([], 'a.svg', { type: 'image/svg+xml' }))).toBe(false);
    expect(isDropzoneCroppableFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toBe(false);
  });

  it('should draw the rect onto the canvas and resolve a file of the output type', async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, fillRect: vi.fn(), fillStyle: '' }),
      toBlob: (callback: BlobCallback, type: string) => callback(new Blob(['x'], { type })),
    } as unknown as HTMLCanvasElement;
    const image = {} as CanvasImageSource;
    const file = new File([], 'photo.png', { type: 'image/png' });

    const result = await exportCroppedImage({
      image,
      rect: { x: 10, y: 20, width: 200, height: 100 },
      config: { aspectRatio: 2, maxWidth: 100 },
      file,
      canvas,
    });

    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 200, 100, 0, 0, 100, 50);
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(50);
    expect(result.name).toBe('photo.png');
    expect(result.type).toBe('image/png');
  });

  it('should reject when the canvas has no 2d context', async () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

    await expect(
      exportCroppedImage({
        image: {} as CanvasImageSource,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        config: { aspectRatio: 1 },
        file: new File([], 'a.png', { type: 'image/png' }),
        canvas,
      }),
    ).rejects.toThrow();
  });
});
