import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SelectOptionDirective } from '@ethlete/components';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedProduct } from '../../host/design';
import { THEMES } from '../../themes';
import { NewProductFormComponent } from './new-product-form.component';
import { SystemViewComponent } from './system-view.component';

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    public onmessage = () => undefined;
  },
  invoke: () => Promise.resolve(),
}));

const product = (name: string, base: string | null = null): ListedProduct => ({
  name,
  base,
  presets: {},
  parts: [],
  problems: [],
});

class SilentEventSource {
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

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const fill = async (fixture: ComponentFixture<unknown>, name: string) => {
  const form = fixture.debugElement.query((node) => node.componentInstance instanceof NewProductFormComponent);

  (form.componentInstance as NewProductFormComponent)['name'].set(name);
  await settle(fixture);
  (form.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await settle(fixture);
};

describe('NewProductFormComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('offers only products without a base as a base', async () => {
    const fixture = TestBed.createComponent(NewProductFormComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('products', [product('web'), product('shop', '.ethlete/design/web')]);
    fixture.autoDetectChanges();
    await settle(fixture);

    expect(fixture.componentInstance['bases']().map((listed) => listed.name)).toEqual(['web']);
  });

  it('lists the built-in base last, also with no product yet', async () => {
    const fixture = TestBed.createComponent(NewProductFormComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.autoDetectChanges();
    await settle(fixture);

    const labels = fixture.debugElement
      .queryAll(By.css('et-select-option'))
      .map((option) => option.injector.get(SelectOptionDirective).label());

    expect(labels).toEqual(['No base', '@ethlete/components']);
  });

  it('shows a refusal of the server in the error theme', async () => {
    vi.stubGlobal('fetch', () => json({ error: 'PRODUCT EXISTS - web is declared' }, 409));
    const fixture = TestBed.createComponent(NewProductFormComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.autoDetectChanges();
    await fill(fixture, 'web');

    const refusal: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector('p');

    expect(refusal?.textContent?.trim()).toBe('PRODUCT EXISTS - web is declared');
    expect([...(refusal?.classList ?? [])].some((name) => name.startsWith('et-color--'))).toBe(true);
  });

  it('creates the product, lists the products again and picks it', async () => {
    const created: unknown[] = [];
    let listed = [product('web')];

    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.includes('/__design/product')) {
        created.push(JSON.parse(String(init?.body)));
        listed = [...listed, product('shop', '.ethlete/design/web')];

        return json({ name: 'shop' }, 201);
      }
      if (url.includes('/__design/system')) return json(listed);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });
    const fixture = TestBed.createComponent(SystemViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.autoDetectChanges();
    await settle(fixture);
    fixture.componentInstance['pickProduct']('/new');
    await settle(fixture);
    fixture.debugElement
      .query((node) => node.componentInstance instanceof NewProductFormComponent)
      .componentInstance['base'].set('web');
    await fill(fixture, 'shop');

    expect(created).toEqual([{ name: 'shop', base: 'web' }]);
    expect(fixture.componentInstance['creating']()).toBe(false);
    expect(fixture.componentInstance['product']()?.name).toBe('shop');
  });
});
