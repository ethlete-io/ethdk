import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { KBD_PLATFORM, kbdKeyLabel, KbdPlatform, kbdKeyName, parseKbdKeys } from './kbd-keys';
import { KBD_IMPORTS } from './kbd.imports';

@Component({
  selector: 'et-test-kbd-host',
  template: `<et-kbd [keys]="keys()" [platform]="platform()" />`,
  imports: [KBD_IMPORTS],
})
class KbdHostComponent {
  public keys = signal('mod+k');
  public platform = signal<KbdPlatform | undefined>(undefined);
}

const create = (keys?: string, platform?: KbdPlatform) => {
  const fixture = TestBed.createComponent(KbdHostComponent);

  if (keys !== undefined) fixture.componentInstance.keys.set(keys);
  if (platform !== undefined) fixture.componentInstance.platform.set(platform);

  fixture.detectChanges();

  const host = fixture.nativeElement.querySelector('et-kbd') as HTMLElement;

  return {
    host,
    caps: [...host.querySelectorAll('kbd.et-kbd-key')].map((cap) => cap.textContent?.trim()),
    allyText: host.querySelector('.et-kbd-ally-text')?.textContent?.trim(),
  };
};

describe('KbdComponent', () => {
  it('renders one keycap per key', () => {
    const { host, caps } = create('mod+shift+k', 'apple');

    expect(host.classList.contains('et-kbd')).toBe(true);
    expect(caps).toEqual(['⌘', '⇧', 'K']);
  });

  it('renders the same chord with the non-Apple spellings', () => {
    expect(create('mod+shift+k', 'other').caps).toEqual(['Ctrl', 'Shift', 'K']);
  });

  it('follows the injected platform when no platform input is set', () => {
    TestBed.configureTestingModule({ providers: [{ provide: KBD_PLATFORM, useValue: 'apple' }] });

    expect(create('mod+k').caps).toEqual(['⌘', 'K']);
  });

  it('hides the glyphs from assistive tech and spells the chord out instead', () => {
    const { host, allyText } = create('mod+alt+arrowup', 'apple');

    const capsAreHidden = [...host.querySelectorAll('kbd.et-kbd-key')].every(
      (cap) => cap.getAttribute('aria-hidden') === 'true',
    );

    expect(allyText).toBe('Command Option Arrow up');
    expect(capsAreHidden).toBe(true);
  });

  it('reacts to a changed chord', () => {
    const fixture = TestBed.createComponent(KbdHostComponent);
    fixture.componentInstance.platform.set('other');
    fixture.detectChanges();

    fixture.componentInstance.keys.set('esc');
    fixture.detectChanges();

    const caps = [...fixture.nativeElement.querySelectorAll('kbd.et-kbd-key')].map((cap) => cap.textContent?.trim());

    expect(caps).toEqual(['Esc']);
  });
});

describe('parseKbdKeys', () => {
  it('splits on + and ignores surrounding whitespace', () => {
    expect(parseKbdKeys(' mod + shift + k ')).toEqual(['mod', 'shift', 'k']);
  });

  it('drops empty segments', () => {
    expect(parseKbdKeys('mod++k')).toEqual(['mod', 'k']);
  });
});

describe('kbdKeyLabel', () => {
  it('resolves aliases case-insensitively', () => {
    expect(kbdKeyLabel('CMD', 'apple')).toBe('⌘');
    expect(kbdKeyLabel('Option', 'apple')).toBe('⌥');
    expect(kbdKeyLabel('Escape', 'other')).toBe('Esc');
    expect(kbdKeyLabel('arrowdown', 'other')).toBe('↓');
  });

  it('keeps meta distinct from mod off Apple', () => {
    expect(kbdKeyLabel('meta', 'other')).toBe('Meta');
    expect(kbdKeyLabel('mod', 'other')).toBe('Ctrl');
  });

  it('renders the literal plus key', () => {
    expect(kbdKeyLabel('plus', 'other')).toBe('+');
  });

  it('capitalizes an unknown key rather than dropping it', () => {
    expect(kbdKeyLabel('f5', 'other')).toBe('F5');
    expect(kbdKeyLabel('a', 'other')).toBe('A');
  });
});

describe('kbdKeyName', () => {
  it('spells out the glyphs', () => {
    expect(kbdKeyName('mod', 'apple')).toBe('Command');
    expect(kbdKeyName('ctrl', 'apple')).toBe('Control');
    expect(kbdKeyName('backspace', 'apple')).toBe('Backspace');
    expect(kbdKeyName('pagedown', 'other')).toBe('Page down');
  });
});
