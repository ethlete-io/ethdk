import { FieldTree, FormFieldBinding } from '@angular/forms/signals';
import { focusElement, getFocusableElements, isFocusable, matchesReducedMotion } from '@ethlete/core';
import { FORM_FIELD_TOKEN } from '../form-field/headless';

export type FocusFirstInvalidFieldOptions = {
  /** Where the field lands in its scroll container. @default 'center' */
  block?: ScrollLogicalPosition;
  /** @default 'smooth', or 'auto' when the user asked for reduced motion */
  behavior?: ScrollBehavior;
  /** Whether to move focus into the field's control. @default true */
  focus?: boolean;
};

const isRendered = (element: HTMLElement) => element.isConnected && element.getClientRects().length > 0;

const firstRenderedInvalidBinding = <T>(field: FieldTree<T>) => {
  let first: FormFieldBinding | null = null;

  for (const error of field().errorSummary()) {
    for (const binding of error.fieldTree().formFieldBindings()) {
      if (!isRendered(binding.element)) {
        continue;
      }

      const precedesFirst =
        !!first && (first.element.compareDocumentPosition(binding.element) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;

      if (!first || precedesFirst) {
        first = binding;
      }
    }
  }

  return first;
};

/**
 * Scrolls the first invalid field of `field` into view and focuses its control - what an invalid
 * submit attempt should do, now that a submit button stays enabled while the form is invalid.
 *
 * "First" is the first field in DOM order, not in field-tree order, and fields that are not
 * currently rendered (a collapsed section, another wizard step) are skipped - so the user lands on
 * an error they can see and fix.
 *
 * `[etForm]` calls this on every failed submit. Call it directly from a hand-written submit handler
 * or a `submission.onInvalid` hook.
 *
 * @returns Whether a field was found. `false` means no rendered field owns any of the form's errors -
 *   a form-level error, for instance.
 */
export const focusFirstInvalidField = <T>(field: FieldTree<T>, options?: FocusFirstInvalidFieldOptions) => {
  const binding = firstRenderedInvalidBinding(field);

  if (!binding) {
    return false;
  }

  const element = binding.element;
  const ownerDocument = element.ownerDocument;
  const fieldShell = binding.injector.get(FORM_FIELD_TOKEN, null);

  (fieldShell?.element ?? element).scrollIntoView({
    block: options?.block ?? 'center',
    inline: 'nearest',
    behavior: options?.behavior ?? (matchesReducedMotion(element) ? 'auto' : 'smooth'),
  });

  if (options?.focus !== false) {
    focusElement(
      isFocusable(element, ownerDocument) ? element : (getFocusableElements(element, ownerDocument)[0] ?? null),
    );
  }

  return true;
};
