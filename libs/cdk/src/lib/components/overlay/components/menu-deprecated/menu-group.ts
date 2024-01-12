/* eslint-disable @angular-eslint/directive-class-suffix */
/* eslint-disable @angular-eslint/no-output-rename */
/* eslint-disable @angular-eslint/no-outputs-metadata-property */
/* eslint-disable @angular-eslint/no-input-rename */
/* eslint-disable @angular-eslint/no-inputs-metadata-property */

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
