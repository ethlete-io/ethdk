import { DIALOG_SCROLL_STRATEGY_PROVIDER as CDK_DIALOG_SCROLL_STRATEGY_PROVIDER, Dialog } from '@angular/cdk/dialog';
import { OVERLAY_SCROLL_STRATEGY_PROVIDER } from './constants';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayTitleDirective,
} from './partials';
import { OverlayService } from './services';

export const OverlayImports = [
  OverlayCloseDirective,
  OverlayTitleDirective,
  OverlayHeaderDirective,
  OverlayBodyComponent,
  OverlayFooterDirective,
] as const;

export const provideOverlay = () => {
  return [OverlayService, OVERLAY_SCROLL_STRATEGY_PROVIDER, Dialog, CDK_DIALOG_SCROLL_STRATEGY_PROVIDER];
};
