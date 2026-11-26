import { NgTemplateOutlet, PlatformLocation } from '@angular/common';
import { Component, input, output, provideZonelessChangeDetection, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dialogOverlayStrategy, provideOverlay } from '@ethlete/components';
import { DesignHarnessComponent } from './design-harness.component';

@Component({
  selector: 'ethlete-fake-chip',
  template: '{{ label() }}{{ removable() ? " x" : "" }}',
  host: { '(click)': 'remove.emit(label())' },
})
class FakeChipComponent {
  label = input('');
  removable = input(false);
  remove = output<string>();
}

@Component({
  selector: 'ethlete-fake-frame',
  template:
    '@if (shot(); as template) {<ng-container *ngTemplateOutlet="template; context: { $implicit: label() }" />}',
  imports: [NgTemplateOutlet],
})
class FakeFrameComponent {
  label = input('');
  shot = input<TemplateRef<{ $implicit: string }> | null>(null);
}

@Component({
  selector: 'ethlete-fake-frame-shots',
  template: '<ng-template #shot let-label><b data-shot>{{ label }}!</b></ng-template>',
})
class FakeFrameShotsComponent {
  private shot = viewChild.required<TemplateRef<{ $implicit: string }>>('shot');

  public templates() {
    return { shot: this.shot() };
  }
}

vi.mock('./design-harness-parts', () => ({
  DESIGN_HARNESS_PARTS: {
    'components/chip': () => Promise.resolve(FakeChipComponent),
    'pages/frame': () => Promise.resolve(FakeFrameComponent),
    'pages/bad': () => Promise.resolve(FakeChipComponent),
    'components/chip-dialog': () => Promise.resolve(FakeChipComponent),
    'components/disclosure': () =>
      import('../design-parts/disclosure/disclosure.component').then((m) => m.DisclosureComponent),
  },
}));

vi.mock('./design-harness-samples', () => ({
  DESIGN_HARNESS_SAMPLES: {
    'pages/bad': () => {
      throw new Error('no sample for prop part=x of part pages/bad');
    },
  },
  DESIGN_HARNESS_PROVIDERS: {},
  DESIGN_HARNESS_DIALOGS: {
    'components/chip-dialog': { config: () => ({ role: 'dialog', strategies: dialogOverlayStrategy() }) },
  },
  get DESIGN_HARNESS_TEMPLATES() {
    return { 'pages/frame': FakeFrameShotsComponent };
  },
}));

const render = async (search: string) => {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideOverlay(),
      { provide: PlatformLocation, useValue: { search } },
    ],
  });

  const fixture = TestBed.createComponent(DesignHarnessComponent);

  for (let round = 0; round < 3; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  return fixture.nativeElement as HTMLElement;
};

describe('DesignHarnessComponent', () => {
  afterEach(() => document.querySelectorAll('.et-overlay-runtime-root').forEach((root) => root.remove()));

  it('opens a dialog part in an overlay pane over a host that fills the viewport, and records its emits', async () => {
    const props = encodeURIComponent(JSON.stringify({ label: 'Tag', removable: true, close: 'hover' }));
    const element = await render(`?part=components%2Fchip-dialog&state=a&props=${props}`);
    const host = element.querySelector('[data-design-harness-host]');
    const chip = document.querySelector<HTMLElement>('.et-overlay-runtime-pane ethlete-fake-chip');

    expect(host?.className).toBe('bg-et-surface-background block h-screen w-screen');
    expect(host?.children).toHaveLength(1);
    expect(host?.querySelector('ethlete-fake-chip')).toBeNull();
    expect(chip?.textContent).toBe('Tag x');
    expect(chip?.hasAttribute('data-design-harness-mounted')).toBe(true);

    chip?.click();

    expect((window as Window & { __etDesignEmits?: unknown }).__etDesignEmits).toEqual([
      { output: 'remove', value: 'Tag' },
    ]);
  });

  it('mounts the part component inside the host element with the props as inputs', async () => {
    const props = encodeURIComponent(JSON.stringify({ label: 'Tag', removable: true }));
    const element = await render(`?part=components%2Fchip&state=removable&props=${props}`);
    const host = element.querySelector('[data-design-harness-host]');

    expect(host?.querySelector('ethlete-fake-chip')?.textContent).toBe('Tag x');
    expect(element.textContent?.trim()).toBe('Tag x');
  });

  it('adds a class prop to the part element instead of setting it as an input', async () => {
    const props = encodeURIComponent(JSON.stringify({ label: 'Tag', class: 'relative  h-56' }));
    const element = await render(`?part=components%2Fchip&state=a&props=${props}`);

    expect(element.querySelector('ethlete-fake-chip')?.className).toBe('relative h-56');
  });

  it('sets no input the part component lacks, as the interaction a disclosure state forces', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const props = encodeURIComponent(
      JSON.stringify({ label: '2 states of pages/inbox without visible change', open: false, interaction: 'hover' }),
    );
    const element = await render(`?part=components%2Fdisclosure&state=rest-hover&props=${props}`);

    expect(element.querySelector('ethlete-disclosure')?.textContent).toContain('2 states of pages/inbox');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('fits the host to its content, and fills the viewport with it for a page layout', async () => {
    const fitted = await render('?part=components%2Fchip&state=a&props=%7B%7D');

    expect(fitted.querySelector('[data-design-harness-host]')?.className).toBe('flow-root w-fit');

    TestBed.resetTestingModule();

    const page = await render('?part=components%2Fchip&state=a&props=%7B%7D&layout=page');

    expect(page.querySelector('[data-design-harness-host]')?.className).toBe('block min-h-screen w-screen');
  });

  it('passes the templates of the part template component as inputs', async () => {
    const props = encodeURIComponent(JSON.stringify({ label: 'Bar' }));
    const element = await render(`?part=pages%2Fframe&state=a&props=${props}`);

    expect(element.querySelector('ethlete-fake-frame [data-shot]')?.textContent).toBe('Bar!');
  });

  it('records each output the part emits on window', async () => {
    const props = encodeURIComponent(JSON.stringify({ label: 'Tag' }));
    const element = await render(`?part=components%2Fchip&state=a&props=${props}`);
    const emits = () => (window as Window & { __etDesignEmits?: unknown }).__etDesignEmits;

    expect(emits()).toEqual([]);

    element.querySelector<HTMLElement>('ethlete-fake-chip')?.click();

    expect(emits()).toEqual([{ output: 'remove', value: 'Tag' }]);
  });

  it('shows only an error text for an unknown part', async () => {
    const element = await render('?part=x&state=y&props=%7B%7D');

    expect(element.querySelector('[data-design-harness-host]')).toBeNull();
    expect(element.textContent?.trim()).toBe('Unknown design part "x".');
  });

  it('marks the error text with the error attribute when a sample refuses the props', async () => {
    const element = await render('?part=pages%2Fbad&state=y&props=%7B%7D');
    const marker = element.querySelector('[data-design-harness-error]');

    expect(element.querySelector('[data-design-harness-host]')).toBeNull();
    expect(marker?.textContent).toContain('no sample for prop part=x of part pages/bad');
  });
});
