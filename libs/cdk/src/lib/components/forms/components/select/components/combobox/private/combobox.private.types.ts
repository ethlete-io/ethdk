import { TemplateRef } from '@angular/core';

export const ComboboxOptionType = {
  Primitive: 'primitive',
  Object: 'object',
} as const;

export interface KeyHandlerResult {
  setFilter?: string;
  overlayOperation?: 'open' | 'close';
  optionAction?:
    | {
        type: 'add';
        option: unknown;
      }
    | {
        type: 'remove';
        option: unknown;
      }
    | {
        type: 'toggle';
        option: unknown;
      }
    | 'clear'
    | 'toggleAll';
}

export type TemplateRefWithOption = TemplateRef<{
  option: unknown;
}>;
