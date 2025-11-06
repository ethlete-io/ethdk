import { Dialog } from '@angular/cdk/dialog';
import { DialogContainerComponent } from './components/dialog-container';
import { DIALOG_SCROLL_STRATEGY_PROVIDER } from './constants';
import { DialogCloseDirective } from './partials/dialog-close';
import { DialogTitleDirective } from './partials/dialog-title';
import { DialogService } from './services';

/**
 * @deprecated Will be removed in v5.
 */
export const DialogImports = [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective] as const;

/**
 * @deprecated Will be removed in v5.
 */
export const provideDialog = () => {
  return [DialogService, DIALOG_SCROLL_STRATEGY_PROVIDER, Dialog];
};
