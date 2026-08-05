import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ToolbarOrientation } from './headless/toolbar.types';
import { TOOLBAR_IMPORTS } from './toolbar.imports';

@Component({
  selector: 'et-test-toolbar-host',
  template: `
    <et-toolbar aria-label="Formatting">
      <button type="button">Bold</button>
      <button [disabled]="italicDisabled()" type="button">Italic</button>
      <button type="button">Link</button>
    </et-toolbar>
  `,
  imports: [TOOLBAR_IMPORTS],
})
class ToolbarDefaultHostComponent {
  public italicDisabled = signal(false);
}

@Component({
  selector: 'et-test-toolbar-configured-host',
  template: `
    <et-toolbar [orientation]="orientation()" aria-label="Formatting">
      <button type="button">Bold</button>
      <button type="button">Italic</button>
    </et-toolbar>
  `,
  imports: [TOOLBAR_IMPORTS],
})
class ToolbarConfiguredHostComponent {
  public orientation = signal<ToolbarOrientation>('horizontal');
}

@Component({
  selector: 'et-test-nested-toolbar-host',
  template: `
    <et-toolbar aria-label="Outer">
      <button type="button">Outer</button>
      <et-toolbar aria-label="Inner">
        <button type="button">Inner</button>
      </et-toolbar>
    </et-toolbar>
  `,
  imports: [TOOLBAR_IMPORTS],
})
class NestedToolbarHostComponent {}

const buttonsOf = (fixture: { nativeElement: HTMLElement }) =>
  Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('ToolbarComponent', () => {
  it('is a horizontal toolbar by default', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    expect(toolbar.getAttribute('role')).toBe('toolbar');
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('reflects the orientation input', () => {
    const fixture = TestBed.createComponent(ToolbarConfiguredHostComponent);
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('gives the first control the only tab stop', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.detectChanges();

    expect(buttonsOf(fixture).map((button) => button.tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves the tab stop to the last focused control', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.detectChanges();

    const buttons = buttonsOf(fixture);

    buttons[2].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('clears the tab stop on a disabled control, so re-enabling it adds no second one', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.componentInstance.italicDisabled.set(true);
    fixture.detectChanges();

    expect(buttonsOf(fixture).map((button) => button.tabIndex)).toEqual([0, -1, -1]);

    fixture.componentInstance.italicDisabled.set(false);
    fixture.detectChanges();

    expect(buttonsOf(fixture).map((button) => button.tabIndex)).toEqual([0, -1, -1]);
  });

  it('wraps arrow key navigation and skips disabled controls', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.componentInstance.italicDisabled.set(true);
    fixture.detectChanges();

    const buttons = buttonsOf(fixture);
    const toolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    buttons[0].focus();
    press(toolbar, 'ArrowRight');

    expect(document.activeElement).toBe(buttons[2]);

    press(toolbar, 'ArrowRight');

    expect(document.activeElement).toBe(buttons[0]);

    press(toolbar, 'ArrowLeft');

    expect(document.activeElement).toBe(buttons[2]);
  });

  it('jumps to the first and last control with Home and End', () => {
    const fixture = TestBed.createComponent(ToolbarDefaultHostComponent);
    fixture.detectChanges();

    const buttons = buttonsOf(fixture);
    const toolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    buttons[1].focus();
    press(toolbar, 'End');

    expect(document.activeElement).toBe(buttons[2]);

    press(toolbar, 'Home');

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('uses the vertical arrow keys when vertical', () => {
    const fixture = TestBed.createComponent(ToolbarConfiguredHostComponent);
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    const buttons = buttonsOf(fixture);
    const toolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    buttons[0].focus();
    press(toolbar, 'ArrowDown');

    expect(document.activeElement).toBe(buttons[1]);

    press(toolbar, 'ArrowRight');

    expect(document.activeElement).toBe(buttons[1]);
  });

  it('leaves a nested toolbar its own controls', () => {
    const fixture = TestBed.createComponent(NestedToolbarHostComponent);
    fixture.detectChanges();

    const [outer, inner] = buttonsOf(fixture);

    expect(outer.tabIndex).toBe(0);
    expect(inner.tabIndex).toBe(0);

    const outerToolbar = fixture.nativeElement.querySelector('et-toolbar') as HTMLElement;

    outer.focus();
    press(outerToolbar, 'ArrowRight');

    expect(document.activeElement).toBe(outer);
  });
});
