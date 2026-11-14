import { SYSTEM_GROUPS } from '../../system-view/system-tree';
import { buildReadySampleOf, SYSTEM_TREE } from './system-page-sample';

describe('SYSTEM_TREE', () => {
  it('lists the layers in the order of the app tree', () => {
    const titles = SYSTEM_TREE.layers.map((layer) => layer.title);
    const appOrder = SYSTEM_GROUPS.map((group) => group.label).filter((label) => titles.includes(label));

    expect(titles).toEqual(appOrder);
  });
});

describe('buildReadySampleOf', () => {
  it('draws a definite blocker while a slow rule still runs as blocked', () => {
    expect(buildReadySampleOf('blocked-checking', 0)).toEqual({
      state: 'blocked',
      blockers: [{ kind: 'problem', text: 'HARDCODED-COLOR: button.component.css' }],
    });
  });
});
