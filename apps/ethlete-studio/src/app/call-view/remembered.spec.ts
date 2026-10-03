import { rememberedView, rememberView } from './remembered';

const KEY = 'ethlete-studio.call-view';

describe('remembered view', () => {
  afterEach(() => localStorage.clear());

  it('reads nothing from missing or corrupt storage', () => {
    expect(rememberedView()).toEqual({});

    localStorage.setItem(KEY, 'not json');
    expect(rememberedView()).toEqual({});

    localStorage.setItem(KEY, '"text"');
    expect(rememberedView()).toEqual({});
  });

  it('drops fields of the wrong type', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ checkout: 1, project: 'p', slug: null, variant: 'v', settledFeature: '' }),
    );

    expect(rememberedView()).toEqual({
      checkout: undefined,
      project: 'p',
      slug: undefined,
      variant: 'v',
      settledFeature: '',
    });
  });

  it('merges a patch into what was stored', () => {
    rememberView({ checkout: '/a', project: 'p' });
    rememberView({ project: '' });

    expect(rememberedView()).toMatchObject({ checkout: '/a', project: '' });
  });
});
