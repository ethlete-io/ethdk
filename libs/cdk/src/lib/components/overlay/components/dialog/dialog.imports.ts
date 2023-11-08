import { DIALOG_SCROLL_STRATEGY_PROVIDER as CDK_DIALOG_SCROLL_STRATEGY_PROVIDER, Dialog } from '@angular/cdk/dialog';
import { DialogContainerComponent } from './components';
import { DIALOG_SCROLL_STRATEGY_PROVIDER } from './constants';
import { DialogCloseDirective, DialogTitleDirective } from './partials';
import { DialogService } from './services';

/**
 * @deprecated Will be removed in v5.
 */
export const DialogImports = [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective] as const;

/**
 * @deprecated Will be removed in v5.
 */
export const provideDialog = () => {
  return [DialogService, DIALOG_SCROLL_STRATEGY_PROVIDER, Dialog, CDK_DIALOG_SCROLL_STRATEGY_PROVIDER];
};
