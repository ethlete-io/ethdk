import { describe, expect, it } from 'vitest';
import { classifyImgClass } from './report';

describe('migrate-from-cdk -> classifyImgClass', () => {
  it('treats a definite box in both axes as the fit mode', () => {
    expect(classifyImgClass('h-10 w-10 object-cover')).toBe('fit');
    expect(classifyImgClass('size-full object-contain')).toBe('fit');
    expect(classifyImgClass('w-[120px] h-1/2')).toBe('fit');
  });

  it('treats one definite axis plus an aspect ratio as the fit mode', () => {
    expect(classifyImgClass('w-full aspect-video object-cover')).toBe('fit');
    expect(classifyImgClass('h-full aspect-[4/3]')).toBe('fit');
  });

  it('treats constraints and auto axes as the element-class mode', () => {
    expect(classifyImgClass('max-h-41 w-auto')).toBe('element-classes');
    expect(classifyImgClass('h-92.5 w-auto max-w-full')).toBe('element-classes');
    expect(classifyImgClass('w-full')).toBe('element-classes');
    expect(classifyImgClass('w-full aspect-auto')).toBe('element-classes');
  });

  it('leaves values it cannot read unclassified', () => {
    expect(classifyImgClass(null)).toBe('unclassified');
    expect(classifyImgClass('rounded-full object-cover')).toBe('unclassified');
    expect(classifyImgClass('md:h-10 md:w-10')).toBe('unclassified');
  });
});
