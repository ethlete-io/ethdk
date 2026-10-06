import { numberAttribute } from '@angular/core';

export const clampProgress = (value: number) => (Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value)));

export const progressOrNull = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? null : numberAttribute(value);
