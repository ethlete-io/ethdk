import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';

const assertInsideSelect = (
  select: SelectDirective | null,
  options: { directiveName: string; element: HTMLElement },
) => {
  const { directiveName, element } = options;

  if (ngDevMode) {
    afterNextRender(() => {
      if (!select) {
        throw new RuntimeError(
          SELECT_ERROR_CODES.STATE_TEMPLATE_OUTSIDE_SELECT,
          `[${directiveName}] Select state templates must be placed inside an [etSelect] element.`,
          { element },
        );
      }
    });
  }
};

/** Replaces the default loading row rendered while the select's `loading` input is true. */
@Directive({ selector: 'ng-template[etSelectLoading]' })
export class SelectLoadingDirective {
  private hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredLoadingTemplate, this);

    assertInsideSelect(this.select, { directiveName: 'SelectLoadingDirective', element: this.hostElement });
  }
}

export type SelectErrorContext = {
  $implicit: string;
};

/** Replaces the default error row rendered while the select's `error` input is set. Context: the error text. */
@Directive({ selector: 'ng-template[etSelectError]' })
export class SelectErrorDirective {
  private hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectErrorContext>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredErrorTemplate, this);

    assertInsideSelect(this.select, { directiveName: 'SelectErrorDirective', element: this.hostElement });
  }
}

/** Replaces the default empty row rendered when no options are visible. */
@Directive({ selector: 'ng-template[etSelectEmpty]' })
export class SelectEmptyDirective {
  private hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredEmptyTemplate, this);

    assertInsideSelect(this.select, { directiveName: 'SelectEmptyDirective', element: this.hostElement });
  }
}
