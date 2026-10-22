import { injectLocale, provideLocale } from '../index';
import { useScenario } from './harness';

describe('provideLocale with a locale', () => {
  const scenario = useScenario({ providers: [provideLocale('de')] });

  it('starts at the given locale and stays writable', () => {
    const s = scenario();
    const { currentLocale } = s.run(() => injectLocale());

    expect(currentLocale()).toBe('de');
    currentLocale.set('fr');
    expect(s.run(() => injectLocale()).currentLocale()).toBe('fr');
  });
});

describe('provideLocale without a locale', () => {
  const scenario = useScenario({ providers: [provideLocale()] });

  it('starts at en', () => {
    expect(
      scenario()
        .run(() => injectLocale())
        .currentLocale(),
    ).toBe('en');
  });
});

describe('without provideLocale', () => {
  const scenario = useScenario();

  it('starts at en', () => {
    expect(
      scenario()
        .run(() => injectLocale())
        .currentLocale(),
    ).toBe('en');
  });
});
