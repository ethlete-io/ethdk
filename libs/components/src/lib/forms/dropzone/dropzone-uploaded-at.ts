import { computed } from '@angular/core';
import { injectLocale } from '@ethlete/core';

export const injectUploadedAtFormatter = () => {
  const locale = injectLocale();
  const dateFormat = computed(() => new Intl.DateTimeFormat(locale.currentLocale(), { dateStyle: 'medium' }));

  return (date: Date | null) => (date ? { iso: date.toISOString(), label: dateFormat().format(date) } : null);
};
