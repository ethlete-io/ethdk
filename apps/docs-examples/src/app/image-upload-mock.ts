import { HttpEventType, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { concat, delay, Observable, of } from 'rxjs';

export const MOCK_IMAGE_UPLOAD_BASE_URL = 'https://images.demo';

const UPLOADED_IMAGE_URL = 'assets/rich-text-editor-image.svg';

let uploadCount = 0;

export const mockImageUploadInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(MOCK_IMAGE_UPLOAD_BASE_URL)) {
    return next(request);
  }

  const progress = [20, 45, 70, 90].map((loaded) =>
    of({ type: HttpEventType.UploadProgress as const, loaded, total: 100 }).pipe(delay(220)),
  );

  const response$ = of(
    new HttpResponse<{ url: string }>({
      status: 200,
      url: request.url,
      body: { url: `${UPLOADED_IMAGE_URL}?upload=${++uploadCount}` },
    }),
  ).pipe(delay(220));

  return concat(...progress, response$) as Observable<never>;
};
