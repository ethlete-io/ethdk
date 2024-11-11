/* eslint-disable @angular-eslint/directive-class-suffix */

import { UniqueSelectionDispatcher } from '@angular/cdk/collections';
import { Directive } from '@angular/core';

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkMenuGroup]',
  exportAs: 'cdkMenuGroup',
  standalone: true,
  host: {
    role: 'group',
    class: 'cdk-menu-group',
  },
  providers: [{ provide: UniqueSelectionDispatcher, useClass: UniqueSelectionDispatcher }],
})
export class CdkMenuGroup {}
