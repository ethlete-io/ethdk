import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WindowChrome } from '../../../host/window';
import { TitleBarComponent } from './title-bar.component';

vi.mock('../../../host/window', () => ({ isWindowMaximized$: () => of(false) }));

type Props = Omit<WindowChrome, 'preferNoCsd'> & { update?: boolean; product?: string; part?: string };

const render = (props: Props) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(TitleBarComponent);

  Object.entries(props).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const bar = element.querySelector<HTMLElement>('[data-tauri-drag-region="deep"]');
  const buttons = [...element.querySelectorAll<HTMLElement>('[data-window-button]')];

  return { fixture, element, bar, buttons, names: buttons.map((button) => button.dataset['windowButton']) };
};

const linux = (left: WindowChrome['left'], right: WindowChrome['right']): Props => ({ os: 'linux', left, right });

describe('TitleBarComponent', () => {
  it('draws only a round close button on the right for appmenu:close', () => {
    const { bar, buttons, names } = render(linux([], ['close']));

    expect(names).toEqual(['close']);
    expect(buttons[0]?.dataset['shape']).toBe('round');
    expect(bar?.lastElementChild?.contains(buttons[0] ?? null)).toBe(true);
  });

  it('draws the buttons on the side and in the order the layout gives', () => {
    const { bar, names } = render(linux(['close', 'minimize'], []));

    expect(names).toEqual(['close', 'minimize']);
    expect(bar?.firstElementChild?.querySelectorAll('[data-window-button]').length).toBe(2);
  });

  it('draws square tiles on Windows', () => {
    const { buttons, names } = render({ os: 'windows', left: [], right: ['minimize', 'maximize', 'close'] });

    expect(names).toEqual(['minimize', 'maximize', 'close']);
    expect(buttons.every((button) => button.dataset['shape'] === 'square')).toBe(true);
  });

  it('reserves the traffic light space on macOS and draws no buttons', () => {
    const { element, names } = render({ os: 'macos', left: [], right: [] });

    expect(names).toEqual([]);
    expect(element.querySelector('.w-19\\.5')).not.toBeNull();
  });

  it('shows the update button only when an update is ready', () => {
    const idle = render({ ...linux([], ['close']), update: false });

    expect(idle.bar?.lastElementChild?.textContent).not.toContain('Update');

    TestBed.resetTestingModule();

    const ready = render({ ...linux([], ['close']), update: true });

    expect(ready.bar?.lastElementChild?.textContent).toContain('Update');
  });

  it('names the product and part in the search field', () => {
    const { element } = render({ os: 'windows', left: [], right: [], product: 'shop', part: 'Checkout Summary' });
    const search = element.querySelector('[aria-haspopup="dialog"]');

    expect(search?.textContent).toContain('shop');
    expect(search?.textContent).toContain('Checkout Summary');
    expect(search?.getAttribute('aria-label')).toBe('Suchen in shop, Checkout Summary');
  });

  it('fires the window outputs from the window buttons', () => {
    const { fixture, buttons } = render(linux(['close'], ['minimize', 'maximize']));
    const fired: string[] = [];
    const { componentInstance: bar } = fixture;

    bar.minimize.subscribe(() => fired.push('minimize'));
    bar.maximize.subscribe(() => fired.push('maximize'));
    bar.close.subscribe(() => fired.push('close'));
    buttons.forEach((button) => button.click());

    expect(fired).toEqual(['close', 'minimize', 'maximize']);
  });

  it('fires the update output with the click from the update button', () => {
    const { fixture, bar } = render({ ...linux([], []), update: true });
    const events: MouseEvent[] = [];

    fixture.componentInstance.updatePress.subscribe((event) => events.push(event));
    bar?.lastElementChild?.querySelector<HTMLElement>('button')?.click();

    expect(events).toHaveLength(1);
  });
});
