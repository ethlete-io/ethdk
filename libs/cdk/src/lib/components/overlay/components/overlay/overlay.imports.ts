import { DIALOG_SCROLL_STRATEGY_PROVIDER as CDK_DIALOG_SCROLL_STRATEGY_PROVIDER, Dialog } from '@angular/cdk/dialog';
import { OverlayContainerComponent } from './components';
import { OVERLAY_SCROLL_STRATEGY_PROVIDER } from './constants';
import { OverlayCloseDirective, OverlayTitleDirective } from './partials';
import { OverlayService } from './services';

export const OverlayImports = [OverlayContainerComponent, OverlayCloseDirective, OverlayTitleDirective] as const;

export const provideOverlay = () => {
  return [OverlayService, OVERLAY_SCROLL_STRATEGY_PROVIDER, Dialog, CDK_DIALOG_SCROLL_STRATEGY_PROVIDER];
};
