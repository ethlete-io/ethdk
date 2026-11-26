import { ComponentType } from '@angular/cdk/portal';
import { TemplateRef } from '@angular/core';

export const ComboboxOptionType = {
  Primitive: 'primitive',
  Object: 'object',
} as const;

export type ComboboxKeyHandlerResult = {
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
};

export type TemplateRefWithOption = TemplateRef<{
  option: unknown;
}>;

export type ComponentWithOption = ComponentType<{
  option: any;
}>;

export type TemplateRefWithError = TemplateRef<{
  error: unknown;
}>;

export type ComponentWithError = ComponentType<{
  error: any;
}>;
