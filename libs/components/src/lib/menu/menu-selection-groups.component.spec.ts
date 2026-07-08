import { ApplicationRef, Component, linkedSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormField, form } from '@angular/forms/signals';
import '../../test-helpers';
import { MenuDirective } from './headless';
import { MENU_IMPORTS } from './menu.imports';

@Component({
  template: `
    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">View options</button>

      <ng-template etMenuSurface>
        <et-menu>
          <et-menu-radio-group [formField]="demoForm.sortBy" class="radio-group">
            <et-menu-group-label>Sort by</et-menu-group-label>
            <et-menu-radio-item class="radio-name" value="name">Name</et-menu-radio-item>
            <et-menu-radio-item class="radio-date" value="date">Date</et-menu-radio-item>
          </et-menu-radio-group>

          <et-menu-separator />

          <et-menu-checkbox-group [formField]="demoForm.columns" class="check-group">
            <et-menu-group-label>Columns</et-menu-group-label>
            <et-menu-checkbox-item class="check-size" value="size">Size</et-menu-checkbox-item>
            <et-menu-checkbox-item class="check-kind" value="kind">Kind</et-menu-checkbox-item>
          </et-menu-checkbox-group>

          <et-menu-checkbox-item [formField]="demoForm.showHidden" class="standalone">
            Show hidden files
          </et-menu-checkbox-item>
        </et-menu>
      </ng-template>
    </div>
  `,
  imports: [...MENU_IMPORTS, FormField],
})
class MenuSelectionGroupsTestHost {
  public formModel = linkedSignal(() => ({
    sortBy: 'name' as string | null,
    columns: ['size'] as string[],
    showHidden: false,
  }));

  public demoForm = form(this.formModel);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('Menu selection groups with signal forms', () => {
  let fixture: ComponentFixture<MenuSelectionGroupsTestHost>;
  let menu: MenuDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const query = <T extends HTMLElement>(selector: string) => {
    const element = document.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Expected element for selector "${selector}"`);
    }

    return element;
  };

  const openMenu = async () => {
    query('.root-trigger').click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MenuSelectionGroupsTestHost],
    });

    fixture = TestBed.createComponent(MenuSelectionGroupsTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('reflects the form state in the rendered selection items', async () => {
    await openMenu();

    expect(query('.radio-name').getAttribute('role')).toBe('menuitemradio');
    expect(query('.radio-name').getAttribute('aria-checked')).toBe('true');
    expect(query('.radio-date').getAttribute('aria-checked')).toBe('false');
    expect(query('.check-size').getAttribute('aria-checked')).toBe('true');
    expect(query('.check-kind').getAttribute('aria-checked')).toBe('false');
    expect(query('.standalone').getAttribute('aria-checked')).toBe('false');
  });

  it('labels the groups through et-menu-group-label', async () => {
    await openMenu();

    const radioGroup = query('.radio-group');
    const label = radioGroup.querySelector('et-menu-group-label');

    expect(radioGroup.getAttribute('role')).toBe('group');
    expect(label?.id).not.toBe('');
    expect(radioGroup.getAttribute('aria-labelledby')).toBe(label?.id);
  });

  it('writes radio selections into the form', async () => {
    await openMenu();

    query('.radio-date').click();
    tick();

    expect(fixture.componentInstance.formModel().sortBy).toBe('date');
    expect(query('.radio-date').getAttribute('aria-checked')).toBe('true');
    expect(menu.open()).toBe(true);
  });

  it('writes checkbox toggles into the form as an array value', async () => {
    await openMenu();

    query('.check-kind').click();
    tick();

    expect(fixture.componentInstance.formModel().columns).toEqual(['size', 'kind']);

    query('.check-size').click();
    tick();

    expect(fixture.componentInstance.formModel().columns).toEqual(['kind']);
  });

  it('binds a standalone checkbox item to a boolean form field', async () => {
    await openMenu();

    query('.standalone').click();
    tick();

    expect(fixture.componentInstance.formModel().showHidden).toBe(true);
    expect(query('.standalone').getAttribute('aria-checked')).toBe('true');
  });

  it('updates the rendered items when the form value changes programmatically', async () => {
    await openMenu();

    fixture.componentInstance.formModel.set({
      sortBy: 'date',
      columns: ['size', 'kind'],
      showHidden: true,
    });
    tick();

    expect(query('.radio-date').getAttribute('aria-checked')).toBe('true');
    expect(query('.check-kind').getAttribute('aria-checked')).toBe('true');
    expect(query('.standalone').getAttribute('aria-checked')).toBe('true');
  });
});
