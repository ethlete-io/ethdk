import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  canonicalKbdKey,
  detectKbdPlatform,
  KBD_IMPORTS,
  KBD_PLATFORM,
  KbdComponent,
  kbdKeyLabel,
  kbdKeyName,
  KbdPlatform,
  matchesKbdChord,
  parseKbdKeys,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const keycaps = (host: Element) => Array.from(host.querySelectorAll('.et-kbd-key')).map((key) => key.textContent);

const spoken = (host: Element) => host.querySelector('.et-kbd-ally-text')?.textContent;

@Component({
  selector: 'et-scenario-shortcut-list',
  imports: [KBD_IMPORTS],
  template: `
    <et-kbd class="search" keys="mod+k" />
    <et-kbd [keys]="saveKeys()" [platform]="platform()" class="save" />
    <et-kbd class="move" keys="shift + option + arrowup" />
    <et-kbd class="zoom" keys="mod+plus" />
    <et-kbd class="custom" keys="ctrl+f5" />
  `,
})
class ShortcutListComponent {
  saveKeys = signal('mod+s');
  platform = signal<KbdPlatform | undefined>(undefined);
}

@Component({
  selector: 'et-scenario-search-shortcut',
  imports: [KbdComponent],
  template: ` <p>Press <et-kbd [keys]="keys" /> to search</p> `,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
class SearchShortcutComponent {
  platform = inject(KBD_PLATFORM);
  keys = 'mod+k';
  opened = 0;

  onKeydown(event: KeyboardEvent) {
    if (matchesKbdChord(event, { keys: this.keys, platform: this.platform })) {
      event.preventDefault();
      this.opened++;
    }
  }
}

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

  document.body.dispatchEvent(event);

  return event;
};

describe('kbd scenarios on a non-Apple platform', () => {
  const scenario = useScenario({ providers: [{ provide: KBD_PLATFORM, useValue: 'other' }] });

  it('renders one hidden keycap per key and a spoken label for screen readers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShortcutListComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const search = host.querySelector('.search')!;

    expect(search.classList).toContain('et-kbd');
    expect(keycaps(search)).toEqual(['Ctrl', 'K']);
    expect(spoken(search)).toBe('Control K');
    expect(Array.from(search.querySelectorAll('.et-kbd-key')).every((key) => key.tagName === 'KBD')).toBe(true);
    expect(Array.from(search.querySelectorAll('.et-kbd-key')).map((key) => key.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
    ]);

    expect(keycaps(host.querySelector('.move')!)).toEqual(['Shift', 'Alt', '↑']);
    expect(spoken(host.querySelector('.move')!)).toBe('Shift Alt Arrow up');
    expect(keycaps(host.querySelector('.zoom')!)).toEqual(['Ctrl', '+']);
    expect(spoken(host.querySelector('.zoom')!)).toBe('Control Plus');
    expect(keycaps(host.querySelector('.custom')!)).toEqual(['Ctrl', 'F5']);
  });

  it('re-renders when the keys change and pins a platform per instance', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShortcutListComponent);
    const save = (fixture.nativeElement as HTMLElement).querySelector('.save')!;

    s.tick();
    expect(keycaps(save)).toEqual(['Ctrl', 'S']);

    fixture.componentInstance.platform.set('apple');
    fixture.componentInstance.saveKeys.set('mod+shift+s');
    s.tick();

    expect(keycaps(save)).toEqual(['⌘', '⇧', 'S']);
    expect(spoken(save)).toBe('Command Shift S');
    expect(keycaps((fixture.nativeElement as HTMLElement).querySelector('.search')!)).toEqual(['Ctrl', 'K']);
  });

  it('fires a shortcut only on its exact chord, with mod meaning Control', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchShortcutComponent);
    const page = fixture.componentInstance;

    s.tick();

    expect(press({ key: 'k', code: 'KeyK', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(page.opened).toBe(1);

    press({ key: 'k', code: 'KeyK', metaKey: true });
    press({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true });
    press({ key: 'k', code: 'KeyK' });
    expect(page.opened).toBe(1);

    press({ key: 'K', code: 'KeyK', ctrlKey: true });
    expect(page.opened).toBe(2);
  });
});

describe('kbd scenarios on an Apple platform', () => {
  const scenario = useScenario({ providers: [{ provide: KBD_PLATFORM, useValue: 'apple' }] });

  it('prints Apple glyphs and matches mod as Command, Option chords by physical key', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SearchShortcutComponent);
    const list = TestBed.createComponent(ShortcutListComponent);

    s.tick();

    expect(keycaps((fixture.nativeElement as HTMLElement).querySelector('et-kbd')!)).toEqual(['⌘', 'K']);
    expect(spoken((fixture.nativeElement as HTMLElement).querySelector('et-kbd')!)).toBe('Command K');
    expect(keycaps((list.nativeElement as HTMLElement).querySelector('.move')!)).toEqual(['⇧', '⌥', '↑']);

    press({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(fixture.componentInstance.opened).toBe(0);

    press({ key: 'k', code: 'KeyK', metaKey: true });
    expect(fixture.componentInstance.opened).toBe(1);

    const optionK = new KeyboardEvent('keydown', { key: '˚', code: 'KeyK', altKey: true });

    expect(matchesKbdChord(optionK, { keys: 'alt+k', platform: 'apple' })).toBe(true);
  });
});

describe('kbd key helpers', () => {
  it('parse, canonicalize, label and name keys for a custom shortcut hint', () => {
    expect(parseKbdKeys(' mod + shift +k ')).toEqual(['mod', 'shift', 'k']);
    expect(parseKbdKeys('mod++')).toEqual(['mod']);
    expect(canonicalKbdKey(' Command ')).toBe('meta');
    expect(canonicalKbdKey('Escape')).toBe('esc');
    expect(canonicalKbdKey('F5')).toBe('f5');

    expect(kbdKeyLabel('mod', 'apple')).toBe('⌘');
    expect(kbdKeyLabel('mod', 'other')).toBe('Ctrl');
    expect(kbdKeyLabel('escape', 'other')).toBe('Esc');
    expect(kbdKeyLabel('q', 'other')).toBe('Q');
    expect(kbdKeyName('esc', 'apple')).toBe('Escape');
    expect(kbdKeyName('option', 'apple')).toBe('Option');
    expect(kbdKeyName('pgdn', 'other')).toBe('Page down');
  });

  it('matches named keys, punctuation typed with Shift, and never a bare modifier chord', () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

    expect(matchesKbdChord(key({ key: 'Escape' }), { keys: 'esc', platform: 'other' })).toBe(true);
    expect(matchesKbdChord(key({ key: 'ArrowUp', shiftKey: true }), { keys: 'shift+up', platform: 'other' })).toBe(
      true,
    );
    expect(matchesKbdChord(key({ key: '?', shiftKey: true }), { keys: '?', platform: 'other' })).toBe(true);
    expect(matchesKbdChord(key({ key: '1', code: 'Digit1', altKey: true }), { keys: 'alt+1', platform: 'other' })).toBe(
      true,
    );
    expect(matchesKbdChord(key({ key: 'Shift', shiftKey: true }), { keys: 'shift', platform: 'other' })).toBe(false);
  });

  it('detects the platform from the navigator', () => {
    const platform = vi.spyOn(navigator, 'platform', 'get');

    platform.mockReturnValue('MacIntel');
    expect(detectKbdPlatform()).toBe('apple');

    platform.mockReturnValue('Win32');
    expect(detectKbdPlatform()).toBe('other');

    platform.mockRestore();
  });
});
