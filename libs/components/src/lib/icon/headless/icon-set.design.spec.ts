import { SDK_ICONS } from '../../../../design/icon-set';
import { ET_BUILT_IN_ICON_NAMES } from './icon-provider';

describe('icon set design mock', () => {
  it('lists every built-in icon once', () => {
    expect(SDK_ICONS.map((icon) => icon.name)).toEqual([...ET_BUILT_IN_ICON_NAMES].sort((a, b) => a.localeCompare(b)));
  });
});
