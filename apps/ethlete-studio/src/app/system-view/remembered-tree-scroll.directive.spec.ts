import { rememberView, rememberedView } from '../studio-view/remembered';
import { canRestoreScroll } from './remembered-tree-scroll.directive';

describe('remembered tree scroll', () => {
  beforeEach(() => localStorage.clear());

  it('stores the tree scroll position and drops a value that is no positive number', () => {
    rememberView({ treeScroll: 240 });
    expect(rememberedView().treeScroll).toBe(240);

    localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ treeScroll: '240' }));
    expect(rememberedView().treeScroll).toBeUndefined();
  });

  it('restores only once the rows are tall enough to reach the position', () => {
    expect(canRestoreScroll(240, { scrollHeight: 300, clientHeight: 200 })).toBe(false);
    expect(canRestoreScroll(240, { scrollHeight: 440, clientHeight: 200 })).toBe(true);
    expect(canRestoreScroll(0, { scrollHeight: 440, clientHeight: 200 })).toBe(false);
  });
});
