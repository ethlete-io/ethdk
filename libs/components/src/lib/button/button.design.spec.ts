import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { button, ButtonMockOptions, iconButton, IconButtonMockOptions } from '../../../design/button';
import '../../test-helpers';
import { mockShapeOf, shapeOf } from '../testing/design-mock-shape';
import { ButtonComponent } from './button.component';
import { IconButtonComponent } from './icon-button.component';
import { ButtonIconAlignment, ButtonSize, ButtonVariant } from './button.types';

@Component({
  imports: [ButtonComponent],
  template: `
    <button
      [variant]="variant()"
      [size]="size()"
      [iconAlignment]="iconAlignment()"
      [pressed]="pressed()"
      [disabled]="disabled()"
      [color]="color()"
      et-button
    >
      <i etIcon>i</i>Save
    </button>
    <a [variant]="variant()" [size]="size()" [color]="color()" et-button href="/x">Go</a>
  `,
})
class ButtonHost {
  public variant = input<ButtonVariant>('filled');
  public size = input<ButtonSize>('md');
  public iconAlignment = input<ButtonIconAlignment>('start');
  public pressed = input<boolean | undefined>(undefined);
  public disabled = input(false);
  public color = input<string | undefined>(undefined);
}

@Component({
  imports: [IconButtonComponent],
  template: `
    <button
      [variant]="variant()"
      [size]="size()"
      [pressed]="pressed()"
      [disabled]="disabled()"
      [color]="color()"
      et-icon-button
      aria-label="Add"
    >
      <i etIcon>i</i>
    </button>
  `,
})
class IconButtonHost {
  public variant = input<ButtonVariant>('transparent');
  public size = input<ButtonSize>('md');
  public pressed = input<boolean | undefined>(undefined);
  public disabled = input(false);
  public color = input<string | undefined>(undefined);
}

const ICON_CASES: Omit<IconButtonMockOptions, 'icon' | 'ariaLabel'>[] = [
  {},
  { variant: 'filled', size: 'xs', color: 'brand', pressed: true },
  { variant: 'outline', size: 'lg', pressed: false },
  { variant: 'tonal', disabled: true },
];

const CASES: ButtonMockOptions[] = [
  { label: 'Save' },
  { label: 'Save', variant: 'outline', size: 'sm', color: 'brand' },
  { label: 'Save', variant: 'tonal', size: 'xl', iconAlignment: 'end', pressed: false },
  { label: 'Save', variant: 'transparent', pressed: true },
  { label: 'Save', disabled: true, size: 'xs' },
];

describe('button design mock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideColorThemesWithTailwind4([
          {
            name: 'brand',
            isDefault: true,
            primary: {
              color: { default: '0 0 0', hover: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
              onColor: { default: '1 1 1' },
            },
          },
        ]),
      ],
    });
  });

  it.each(CASES)('draws the classes the component renders for %o', async (options) => {
    const fixture = TestBed.createComponent(ButtonHost);

    for (const name of ['variant', 'size', 'iconAlignment', 'pressed', 'disabled', 'color'] as const) {
      if (options[name] !== undefined) fixture.componentRef.setInput(name, options[name]);
    }

    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fixture.detectChanges();

    const [real, anchor] = fixture.nativeElement.querySelectorAll('[et-button]');

    expect(mockShapeOf(button({ ...options, icon: '<i>i</i>' }), '.et-button')).toEqual(shapeOf(real));

    if (!options.pressed && !options.disabled && options.iconAlignment !== 'end') {
      expect(mockShapeOf(button({ ...options, tag: 'a' }), '.et-button')).toEqual(shapeOf(anchor));
    }
  });

  it.each(ICON_CASES)('draws the icon-only button the component renders for %o', async (options) => {
    const fixture = TestBed.createComponent(IconButtonHost);

    for (const name of ['variant', 'size', 'pressed', 'disabled', 'color'] as const) {
      if (options[name] !== undefined) fixture.componentRef.setInput(name, options[name]);
    }

    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fixture.detectChanges();

    const real = fixture.nativeElement.querySelector('[et-icon-button]');

    expect(mockShapeOf(iconButton({ ...options, icon: '<i>i</i>', ariaLabel: 'Add' }), '.et-icon-button')).toEqual(
      shapeOf(real),
    );
  });
});
