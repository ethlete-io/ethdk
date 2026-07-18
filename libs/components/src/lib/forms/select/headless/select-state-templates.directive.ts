import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

const assertInsideSelect = (select: SelectDirective | null, directiveName: string) => {
  if (ngDevMode) {
    afterNextRender(() => {
      if (!select) {
        throw new RuntimeError(
          SELECT_ERROR_CODES.STATE_TEMPLATE_OUTSIDE_SELECT,
          `[${directiveName}] Select state templates must be placed inside an [etSelect] element.`,
        );
      }
    });
  }
};

/** Replaces the default loading row rendered while the select's `loading` input is true. */
@Directive({ selector: 'ng-template[etSelectLoading]' })
export class SelectLoadingDirective {
  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredLoadingTemplate, this);

    assertInsideSelect(this.select, 'SelectLoadingDirective');
  }
}

export type SelectErrorContext = {
  $implicit: string;
};

/** Replaces the default error row rendered while the select's `error` input is set. Context: the error text. */
@Directive({ selector: 'ng-template[etSelectError]' })
export class SelectErrorDirective {
  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectErrorContext>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredErrorTemplate, this);

    assertInsideSelect(this.select, 'SelectErrorDirective');
  }
}

/** Replaces the default empty row rendered when no options are visible. */
@Directive({ selector: 'ng-template[etSelectEmpty]' })
export class SelectEmptyDirective {
  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredEmptyTemplate, this);

    assertInsideSelect(this.select, 'SelectEmptyDirective');
  }
}
