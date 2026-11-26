import { FormDirective } from './form.directive';

/** `[etForm]` - submits a `<form>` through its signal form and lands the user on the first error. */
export const FORM_IMPORTS = [FormDirective] as const;
