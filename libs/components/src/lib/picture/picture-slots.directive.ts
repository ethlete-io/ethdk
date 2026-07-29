import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * What to show while the image is still loading — a blurred `data:` URI, a solid block, a
 * [skeleton](/components/skeleton). Optional; without it the space simply stays empty.
 *
 * @example
 * <ng-template etPicturePlaceholder><et-skeleton-item shape="rect" /></ng-template>
 */
@Directive({ selector: 'ng-template[etPicturePlaceholder]' })
export class PicturePlaceholderDirective {
  public templateRef = inject<TemplateRef<void>>(TemplateRef);
}

/**
 * What to show when the image fails to load. Optional — without it a broken image renders as the browser's
 * broken-image icon, which is rarely what a page wants.
 *
 * @example
 * <ng-template etPictureError><p>This image is unavailable.</p></ng-template>
 */
@Directive({ selector: 'ng-template[etPictureError]' })
export class PictureErrorDirective {
  public templateRef = inject<TemplateRef<void>>(TemplateRef);
}
