import { provideZonelessChangeDetection, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedProduct } from '../../host/design';
import { THEMES } from '../../themes';
import { FlowsPageComponent } from '../design-parts/flows-page/flows-page.component';
import { InboxComponent } from '../design-parts/inbox/inbox.component';
import { InventoryPageComponent } from '../design-parts/inventory-page/inventory-page.component';
import { MergeComponent } from '../design-parts/merge/merge.component';
import { ShellAction } from '../design-parts/shell-main/shell-page.component';
import { SketchesComponent } from '../design-parts/sketches/sketches.component';
import { SystemPageComponent } from '../design-parts/system-page/system-page.component';
import { SystemViewComponent } from './system-view.component';

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    public onmessage = () => undefined;
  },
  invoke: () => Promise.resolve(),
}));

class Silent {
  public observe() {
    return undefined;
  }

  public unobserve() {
    return undefined;
  }

  public disconnect() {
    return undefined;
  }

  public addEventListener() {
    return undefined;
  }

  public removeEventListener() {
    return undefined;
  }

  public close() {
    return undefined;
  }
}

const PRODUCT: ListedProduct = { name: 'web', base: null, presets: {}, parts: [], problems: [] };

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const logoOf = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>(
    'ethlete-shell-main > div > nav > div:first-child button[aria-label="Studio-Menü"]',
  );

const studioMenu = () => document.querySelector('et-menu[aria-label="Studio"]');

const opensTheStudioMenu = async (root: HTMLElement, fixture: ComponentFixture<unknown>) => {
  const logo = logoOf(root);
  const closed = studioMenu() === null;

  logo?.click();
  await settle(fixture);

  const opened = studioMenu() !== null;

  logo?.click();
  await settle(fixture);

  return { button: logo !== null, closed, opened };
};

const mount = async <T>(component: Type<T>) => {
  const fixture = TestBed.createComponent(component);

  fixture.autoDetectChanges();
  await settle(fixture as ComponentFixture<unknown>);

  return fixture;
};

const navButton = (root: HTMLElement, label: string) =>
  root.querySelector<HTMLButtonElement>(`ethlete-shell-main nav button[aria-label="${label}"]`);

describe('the rail logo on every live page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', Silent);
    vi.stubGlobal('EventSource', Silent);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('is a button that opens the studio menu on the live System, Inbox and Flows sections', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = TestBed.createComponent(SystemViewComponent);
    const root = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput('port', 4402);
    fixture.autoDetectChanges();
    await settle(fixture as ComponentFixture<unknown>);

    const seen = { System: await opensTheStudioMenu(root, fixture as ComponentFixture<unknown>) };

    for (const section of ['Inbox', 'Flows'] as const) {
      navButton(root, section)?.click();
      await settle(fixture as ComponentFixture<unknown>);
      expect(root.querySelector('nav button[aria-current="page"]')?.getAttribute('aria-label')).toBe(section);
      Object.assign(seen, { [section]: await opensTheStudioMenu(root, fixture as ComponentFixture<unknown>) });
    }

    const works = { button: true, closed: true, opened: true };

    expect(seen).toEqual({ System: works, Inbox: works, Flows: works });
  });

  const PAGES: [string, Type<unknown>][] = [
    ['system', SystemPageComponent],
    ['flows', FlowsPageComponent],
    ['sketches', SketchesComponent],
    ['merge', MergeComponent],
    ['inventory', InventoryPageComponent],
    ['inbox', InboxComponent],
  ];

  it.each(PAGES)('is a button that opens the studio menu on the %s page', async (_, page) => {
    const fixture = await mount(page);

    expect(
      await opensTheStudioMenu(fixture.nativeElement as HTMLElement, fixture as ComponentFixture<unknown>),
    ).toEqual({
      button: true,
      closed: true,
      opened: true,
    });
  });

  it.each(PAGES)('routes every rail and panel control of the %s page to one shell action', async (_, page) => {
    const fixture = await mount(page);
    const root = fixture.nativeElement as HTMLElement;
    const actions: ShellAction[] = [];
    const other = root.querySelector('nav button[aria-current="page"]')?.getAttribute('aria-label') === 'Flows';

    (
      fixture.componentInstance as { shellAction: { subscribe: (next: (action: ShellAction) => void) => void } }
    ).shellAction.subscribe((action) => actions.push(action));

    navButton(root, other ? 'Inbox' : 'Flows')?.click();
    navButton(root, 'timetrack')?.click();
    navButton(root, 'All products')?.click();
    root.querySelector<HTMLButtonElement>('ethlete-shell-main aside header button')?.click();

    expect(actions).toEqual([
      { kind: 'section', section: other ? 'Inbox' : 'Flows' },
      { kind: 'product', name: 'timetrack' },
      { kind: 'allProducts' },
      { kind: 'collapse' },
    ]);
  });
});
