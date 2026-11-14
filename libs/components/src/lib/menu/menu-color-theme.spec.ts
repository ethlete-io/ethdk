import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ProvideColorDirective,
  provideColorThemesWithTailwind4,
  type ColorTheme,
  type ThemeColor,
} from '@ethlete/core';
import '../../test-helpers';
import { MENU_IMPORTS } from './menu.imports';

const theme = (name: string, color: ThemeColor, isDefault = false): ColorTheme => ({
  name,
  isDefault,
  primary: {
    color: { default: color, hover: color, active: color, disabled: color },
    onColor: { default: '255 255 255' },
  },
});

@Component({
  template: `
    <div etMenu>
      <button etMenuTrigger type="button">Open</button>

      <ng-template etMenuSurface>
        <et-menu etProvideColor="brand">
          <button class="themed" et-menu-item etProvideColor="accent" type="button">Themed</button>
          <button class="plain" et-menu-item type="button">Plain</button>
        </et-menu>
      </ng-template>
    </div>
  `,
  imports: [MENU_IMPORTS, ProvideColorDirective],
})
class Host {}

describe('Menu color theming', () => {
  afterEach(() => {
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('applies etProvideColor on the panel and on a single item', async () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideColorThemesWithTailwind4([theme('brand', '255 0 0', true), theme('accent', '0 255 0')])],
    });

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(document.querySelector('et-menu')?.classList.contains('et-color--brand')).toBe(true);
    expect(document.querySelector('.themed')?.classList.contains('et-color--accent')).toBe(true);
    expect(document.querySelector('.plain')?.classList.contains('et-color--accent')).toBe(false);
  });
});
