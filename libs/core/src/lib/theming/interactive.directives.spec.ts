import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorInteractiveContainerDirective } from './color-interactive-container.directive';
import { ColorInteractiveExcludeDirective } from './color-interactive-exclude.directive';
import { ColorInteractiveHasFocusDirective } from './color-interactive-has-focus.directive';
import { ColorInteractiveDirective } from './color-interactive.directive';
import { SurfaceInteractiveDirective } from './surface-interactive.directive';

@Component({
  template: `
    <button id="color" etColorInteractive></button>
    <div id="container" etColorInteractiveContainer></div>
    <div id="has-focus" etColorInteractiveHasFocus></div>
    <div id="exclude" etColorInteractiveExclude></div>
    <button id="surface" etSurfaceInteractive></button>
  `,
  imports: [
    ColorInteractiveDirective,
    ColorInteractiveContainerDirective,
    ColorInteractiveHasFocusDirective,
    ColorInteractiveExcludeDirective,
    SurfaceInteractiveDirective,
  ],
})
class HostComponent {}

describe('interactive directives', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('put their marker class on the host', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('#color')?.classList).toContain('et-color-interactive');
    expect(root.querySelector('#container')?.classList).toContain('et-color-interactive-container');
    expect(root.querySelector('#has-focus')?.classList).toContain('et-color-interactive--has-focus');
    expect(root.querySelector('#exclude')?.classList).toContain('et-color-interactive-exclude');
    expect(root.querySelector('#surface')?.classList).toContain('et-surface-interactive');
  });

  it('mount each styles component once, shared by the color directives', () => {
    TestBed.createComponent(HostComponent);

    expect(document.querySelectorAll('et-color-interactive-styles')).toHaveLength(1);
    expect(document.querySelectorAll('et-surface-interactive-styles')).toHaveLength(1);
  });

  it('exclude does not mount any styles', () => {
    @Component({ template: '<div etColorInteractiveExclude></div>', imports: [ColorInteractiveExcludeDirective] })
    class ExcludeOnly {}

    TestBed.createComponent(ExcludeOnly);

    expect(document.querySelectorAll('et-color-interactive-styles')).toHaveLength(0);
  });
});
