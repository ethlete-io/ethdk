export interface ValidatorErrors {
  min?: { min: number; actual: number };
  max?: { max: number; actual: number };
  required?: true;
  email?: true;
  minlength?: { requiredLength: number; actualLength: number };
  maxlength?: { requiredLength: number; actualLength: number };
  pattern?: { requiredPattern: string; actualValue: string };
  [key: string]: unknown;
}
