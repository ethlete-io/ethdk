import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import { WindowChrome } from '../../../host/window';
import { TitleBarComponent } from './title-bar.component';

const host = vi.hoisted(() => ({
  chrome: vi.fn<() => Observable<WindowChrome>>(),
  close: vi.fn<() => Observable<void>>(),
}));

vi.mock('../../../host/window', () => ({
  windowChrome$: host.chrome,
  closeWindow$: host.close,
  minimizeWindow$: () => EMPTY,
  toggleMaximizeWindow$: () => EMPTY,
  isWindowMaximized$: () => of(false),
}));

const render = (chrome: Observable<WindowChrome>) => {
  host.chrome.mockReturnValue(chrome);
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(TitleBarComponent);

  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const buttons = [...element.querySelectorAll<HTMLElement>('[data-window-button]')];

  return { element, buttons, names: buttons.map((button) => button.dataset['windowButton']) };
};

const linux = (left: WindowChrome['left'], right: WindowChrome['right']): WindowChrome => ({
  os: 'linux',
  left,
  right,
  preferNoCsd: false,
});

describe('TitleBarComponent', () => {
  it('draws only a round close button on the right for appmenu:close', () => {
    const { element, buttons, names } = render(of(linux([], ['close'])));

    expect(names).toEqual(['close']);
    expect(buttons[0]?.dataset['shape']).toBe('round');
    expect(element.querySelector('[data-tauri-drag-region] > :last-child')?.contains(buttons[0] ?? null)).toBe(true);
  });

  it('draws the buttons on the side and in the order the layout gives', () => {
    const { element, names } = render(of(linux(['close', 'minimize'], [])));
    const bar = element.querySelector('[data-tauri-drag-region]');

    expect(names).toEqual(['close', 'minimize']);
    expect(bar?.firstElementChild?.querySelectorAll('[data-window-button]').length).toBe(2);
  });

  it('draws square tiles on Windows', () => {
    const { buttons, names } = render(
      of({ os: 'windows', left: [], right: ['minimize', 'maximize', 'close'], preferNoCsd: false }),
    );

    expect(names).toEqual(['minimize', 'maximize', 'close']);
    expect(buttons.every((button) => button.dataset['shape'] === 'square')).toBe(true);
  });

  it('reserves the traffic light space on macOS and draws no buttons', () => {
    const { element, names } = render(of({ os: 'macos', left: [], right: [], preferNoCsd: false }));

    expect(names).toEqual([]);
    expect(element.querySelector('.w-19\\.5')).not.toBeNull();
  });

  it('closes the window from the close button', () => {
    host.close.mockReturnValue(EMPTY);
    const { buttons } = render(of(linux([], ['close'])));

    buttons[0]?.click();

    expect(host.close).toHaveBeenCalled();
  });

  it('draws no title bar outside the desktop shell', () => {
    const { element } = render(throwError(() => new Error('no shell')));

    expect(element.querySelector('[data-tauri-drag-region]')).toBeNull();
  });
});
