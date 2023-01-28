import { Dialog, DIALOG_SCROLL_STRATEGY_PROVIDER as CDK_DIALOG_SCROLL_STRATEGY_PROVIDER } from '@angular/cdk/dialog';
import { DialogContainerComponent } from './components';
import { DIALOG_SCROLL_STRATEGY_PROVIDER } from './constants';
import { DialogCloseDirective, DialogTitleDirective } from './partials';
import { DialogService } from './services';

export const DialogImports = [DialogContainerComponent, DialogCloseDirective, DialogTitleDirective] as const;

export const DialogDefaultProviders = [
  DialogService,
  DIALOG_SCROLL_STRATEGY_PROVIDER,
  Dialog,
  CDK_DIALOG_SCROLL_STRATEGY_PROVIDER,
];
