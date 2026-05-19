export const FORM_FIELD_APPEARANCES = {
  BOX: 'box',
  UNDERLINE: 'underline',
} as const;

export type FormFieldAppearance = (typeof FORM_FIELD_APPEARANCES)[keyof typeof FORM_FIELD_APPEARANCES];

export const FORM_FIELD_FILLS = {
  TRANSPARENT: 'transparent',
  FILLED: 'filled',
} as const;

export type FormFieldFill = (typeof FORM_FIELD_FILLS)[keyof typeof FORM_FIELD_FILLS];

export const FORM_FIELD_LABEL_MODES = {
  STATIC: 'static',
  INLINE: 'inline',
  FLOATING_INSIDE: 'floating-inside',
  FLOATING_OUTSIDE: 'floating-outside',
} as const;

export type FormFieldLabelMode = (typeof FORM_FIELD_LABEL_MODES)[keyof typeof FORM_FIELD_LABEL_MODES];

export const FORM_FIELD_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

export type FormFieldSize = (typeof FORM_FIELD_SIZES)[keyof typeof FORM_FIELD_SIZES];
