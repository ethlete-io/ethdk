import { TestBed } from '@angular/core/testing';
import { defineLabels } from './labels';
import { injectLocale } from './locale';

type Labels = { close: string; open: string };

describe('defineLabels', () => {
  const labels = defineLabels<Labels>('TEST_LABELS', { close: 'Close', open: 'Open' });

  const read = () => TestBed.runInInjectionContext(() => labels.inject());

  it('returns the defaults when nothing is provided', () => {
    expect(read()()).toEqual({ close: 'Close', open: 'Open' });
  });

  it('layers a partial override over the defaults', () => {
    TestBed.configureTestingModule({ providers: [labels.provide({ close: 'Zu' })] });

    expect(read()()).toEqual({ close: 'Zu', open: 'Open' });
  });

  it('re-resolves a function source when the locale changes', () => {
    TestBed.configureTestingModule({
      providers: [labels.provide((locale) => ({ close: `close-${locale}` }))],
    });

    const result = read();
    expect(result().close).toBe('close-en');

    TestBed.runInInjectionContext(() => injectLocale()).currentLocale.set('de');

    expect(result().close).toBe('close-de');
  });

  it('resolves locale-derived defaults', () => {
    const localized = defineLabels<Labels>('LOCALIZED_LABELS', (locale) => ({
      close: locale === 'de' ? 'Schließen' : 'Close',
      open: 'Open',
    }));

    TestBed.runInInjectionContext(() => injectLocale()).currentLocale.set('de');

    expect(TestBed.runInInjectionContext(() => localized.inject())().close).toBe('Schließen');
  });
});
