import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform = initials;
}

/**
 * Extracts the initials from a name (or any whitespace separated string).
 *
 * Words are split on whitespace, and the first character of each word is taken.
 * At most `maxLength` initials are returned (defaults to 2), always uppercased.
 *
 * @example
 * initials('John Doe') // 'JD'
 * initials('john doe smith') // 'JD'
 * initials('john doe smith', 3) // 'JDS'
 * initials('Madonna') // 'M'
 * initials('  ') // ''
 * initials(null) // ''
 */
export const initials = (value: string | null | undefined, maxLength = 2) => {
  if (!value) return '';

  const words = value.trim().split(/\s+/).filter(Boolean);

  if (!words.length) return '';

  return words
    .slice(0, maxLength)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};
