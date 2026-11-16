import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideMenuConfig } from './menu-config';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `
    <div [arrow]="false" etMenu>
      <button etMenuTrigger type="button">Open</button>
      <ng-template etMenuSurface />
    </div>
    <div [arrow]="false" [offset]="1" etMenu>
      <button etMenuTrigger type="button">Open</button>
      <ng-template etMenuSurface />
    </div>
  `,
  imports: [MenuDirective, MenuTriggerDirective, MenuSurfaceDirective],
})
class Host {}

const resolvedOffsets = (providers: ReturnType<typeof provideMenuConfig> = []) => {
  TestBed.configureTestingModule({ providers });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();

  return fixture.debugElement.children
    .map((child) => child.injector.get(MenuDirective))
    .map((menu) => (menu as unknown as { resolvedOffset: () => unknown }).resolvedOffset());
};

describe('provideMenuConfig', () => {
  it('keeps the 4px root offset without a provider', () => {
    expect(resolvedOffsets()).toEqual([4, 1]);
  });

  it('replaces the default root offset', () => {
    expect(resolvedOffsets(provideMenuConfig({ offset: 2 }))[0]).toBe(2);
  });

  it('lets a trigger offset win', () => {
    expect(resolvedOffsets(provideMenuConfig({ offset: 2 }))[1]).toBe(1);
  });
});
