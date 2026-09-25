import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import {
  computedTillTruthy,
  controlValueSignalWithPrevious,
  signalHostAttributes,
  signalHostClasses,
  signalHostStyles,
  syncSignal,
} from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-tile', template: '' })
class TileComponent {
  active = signal(false);
  busy = signal<boolean | null>(null);
  size = signal<string | null>('md');
  height = signal<string | null>(null);
  inert = signal(false);

  classes = signalHostClasses({ 'is-active is-selected': this.active, 'is-busy': this.busy });
  attributes = signalHostAttributes({ 'aria-busy': this.busy, 'data-size': this.size, inert: this.inert });
  styles = signalHostStyles({ 'max-height': this.height });
}

@Component({ selector: 'et-scenario-editor', template: '' })
class EditorComponent {
  initial = input('');
  draft = signal('');
  firstUser = computedTillTruthy(this.draft);
  name = new FormControl('ada', { nonNullable: true });
  nameChange = controlValueSignalWithPrevious(this.name);

  constructor() {
    syncSignal(this.initial, this.draft, { skipSyncRead: true });
  }
}

describe('element binding scenarios', () => {
  const scenario = useScenario();

  it('binds classes, attributes and styles on the host and follows their signals', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TileComponent);
    const host = fixture.nativeElement as HTMLElement;
    const tile = fixture.componentInstance;

    s.tick();

    expect(host.className).toBe('');
    expect(host.getAttribute('data-size')).toBe('md');
    expect(host.hasAttribute('aria-busy')).toBe(false);
    expect(host.hasAttribute('inert')).toBe(false);

    tile.active.set(true);
    tile.busy.set(false);
    tile.inert.set(true);
    tile.height.set('20rem');
    s.tick();

    expect(host.classList.value).toBe('is-active is-selected');
    expect(host.getAttribute('aria-busy')).toBe('false');
    expect(host.getAttribute('inert')).toBe('');
    expect(host.style.maxHeight).toBe('20rem');

    tile.busy.set(true);
    tile.size.set(null);
    tile.inert.set(false);
    tile.height.set(null);
    s.tick();

    expect(host.classList.value).toBe('is-active is-selected is-busy');
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.hasAttribute('data-size')).toBe(false);
    expect(host.hasAttribute('inert')).toBe(false);
    expect(host.style.maxHeight).toBe('');

    tile.classes.remove('is-busy');
    tile.busy.set(false);
    tile.attributes.push('role', signal('group'));
    s.tick();

    expect(tile.classes.has('is-busy')).toBe(false);
    expect(host.classList.value).toBe('is-active is-selected');
    expect(host.getAttribute('role')).toBe('group');

    fixture.destroy();
  });

  it('syncs an input into local state, keeps the first truthy value and pairs control values with the last one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorComponent);
    const editor = fixture.componentInstance;

    fixture.componentRef.setInput('initial', '');
    s.tick();

    expect(editor.draft()).toBe('');
    expect(editor.firstUser()).toBeNull();
    expect(editor.nameChange()).toEqual([null, 'ada']);

    fixture.componentRef.setInput('initial', 'grace');
    s.tick();

    expect(editor.draft()).toBe('grace');
    expect(editor.firstUser()).toBe('grace');

    editor.draft.set('local edit');
    fixture.componentRef.setInput('initial', 'linus');
    s.tick();

    expect(editor.draft()).toBe('linus');
    expect(editor.firstUser()).toBe('grace');

    editor.name.setValue('alan');
    s.tick();

    expect(editor.nameChange()).toEqual(['ada', 'alan']);

    fixture.destroy();
  });
});
