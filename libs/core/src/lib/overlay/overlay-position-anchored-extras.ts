import { arrow, hide, size } from '@floating-ui/dom';
import { registerAnchoredPositionMiddlewareExtras } from './overlay-position-anchored';

/**
 * Installs the floating-ui middleware anchored overlays need for `autoResize`, `autoHide`,
 * `autoCloseIfReferenceHidden` and arrows. Call it once wherever such an overlay is built - an
 * anchored overlay that uses none of those features does not bundle this middleware.
 */
export const enableAnchoredOverlayPositionExtras = () => {
  registerAnchoredPositionMiddlewareExtras({ size, arrow, hide });
};
