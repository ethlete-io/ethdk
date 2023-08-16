import { Primitive } from '../types';

export const isPrimitiveArray = (value: unknown): value is Array<Primitive> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first !== 'object' && typeof last !== 'object';
};

export const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return false;

  const first = value[0];
  const last = value[value.length - 1];

  if (!first || !last) return false;

  return typeof first === 'object' && typeof last === 'object' && !Array.isArray(first) && !Array.isArray(last);
};

export const isEmptyArray = (value: unknown): value is [] => {
  return Array.isArray(value) && value.length === 0;
};
