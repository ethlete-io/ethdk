import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'slugify' })
export class SlugifyPipe implements PipeTransform {
  transform = slugify;
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * Diacritics are stripped, the string is lowercased, and any run of
 * non-alphanumeric characters becomes a single hyphen. Leading/trailing
 * hyphens are trimmed.
 *
 * @example
 * slugify('Hello World') // 'hello-world'
 * slugify('  Crème brûlée!  ') // 'creme-brulee'
 * slugify('FC Bayern München') // 'fc-bayern-munchen'
 * slugify('foo_bar / baz') // 'foo-bar-baz'
 * slugify(null) // ''
 */
export const slugify = (value: string | null | undefined) => {
  if (!value) return '';

  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
