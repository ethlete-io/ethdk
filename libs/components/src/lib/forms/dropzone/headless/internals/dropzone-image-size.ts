import { catchError, defer, map, Observable, of } from 'rxjs';
import { DropzoneCropSize } from './dropzone-crop-math';

const readWithImageElement = (file: File) =>
  new Observable<DropzoneCropSize | null>((subscriber) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      subscriber.next({ width: image.naturalWidth, height: image.naturalHeight });
      subscriber.complete();
    };
    image.onerror = () => {
      subscriber.next(null);
      subscriber.complete();
    };
    image.src = url;

    return () => {
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  });

export const readDropzoneImageSize = (file: File): Observable<DropzoneCropSize | null> => {
  if (typeof createImageBitmap !== 'function') return readWithImageElement(file);

  return defer(() => createImageBitmap(file)).pipe(
    map((bitmap) => {
      const size = { width: bitmap.width, height: bitmap.height };

      bitmap.close();

      return size;
    }),
    catchError(() => of(null)),
  );
};
