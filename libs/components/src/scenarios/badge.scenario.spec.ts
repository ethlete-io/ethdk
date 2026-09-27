import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  BADGE_ICON_ALIGNMENTS,
  BADGE_IMPORTS,
  BADGE_SIZES,
  BADGE_VARIANTS,
  BadgeComponent,
  BadgeIconAlignment,
  BadgeSize,
  BadgeVariant,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'positive', type: 'success', primary: swatch('20 160 60') },
];

@Component({
  selector: 'et-scenario-member-status',
  imports: [BADGE_IMPORTS],
  template: `
    <et-badge [variant]="variant()" [size]="size()" [iconAlignment]="alignment()" class="status" color="positive">
      <i class="check" etIcon></i>
      {{ label() }}
    </et-badge>
    <et-badge class="plain">Beta</et-badge>
  `,
})
class MemberStatusComponent {
  variant = signal<BadgeVariant>(BADGE_VARIANTS.FILLED);
  size = signal<BadgeSize>(BADGE_SIZES.SM);
  alignment = signal<BadgeIconAlignment>(BADGE_ICON_ALIGNMENTS.START);
  label = signal('Active');
}

const children = (host: Element) =>
  Array.from(host.childNodes)
    .filter(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
    )
    .map((node) =>
      node.nodeType === Node.ELEMENT_NODE ? (node as Element).className : `text:${node.textContent?.trim()}`,
    );

@Component({
  selector: 'et-scenario-plan-badge',
  imports: [BadgeComponent],
  template: `<et-badge [variant]="variant()" size="lg">Pro</et-badge>`,
})
class PlanBadgeComponent {
  variant = signal<BadgeVariant>(BADGE_VARIANTS.OUTLINE);
  badge = viewChild.required(BadgeComponent);
}

describe('badge scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('renders a tonal medium badge with the icon first by default', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MemberStatusComponent);
    const plain = (fixture.nativeElement as HTMLElement).querySelector('.plain')!;

    s.tick();

    expect(plain.classList).toContain('et-badge');
    expect(plain.getAttribute('data-variant')).toBe('tonal');
    expect(plain.getAttribute('data-size')).toBe('md');
    expect(plain.getAttribute('data-icon-alignment')).toBe('start');
    expect(plain.textContent?.trim()).toBe('Beta');
    expect(plain.querySelector('.et-badge-icon')?.children.length).toBe(0);
  });

  it('moves the projected icon to either side and follows the variant, size and colour', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MemberStatusComponent);
    const page = fixture.componentInstance;
    const status = (fixture.nativeElement as HTMLElement).querySelector('.status')!;

    s.tick();

    expect(status.getAttribute('data-variant')).toBe('filled');
    expect(status.getAttribute('data-size')).toBe('sm');
    expect(status.classList).toContain('et-color--positive');
    expect(children(status)).toEqual(['et-badge-icon', 'text:Active']);
    expect(status.querySelector('.et-badge-icon > .check')).not.toBeNull();

    page.alignment.set(BADGE_ICON_ALIGNMENTS.END);
    page.variant.set(BADGE_VARIANTS.OUTLINE);
    page.size.set(BADGE_SIZES.LG);
    page.label.set('3 new');
    s.tick();

    expect(children(status)).toEqual(['text:3 new', 'et-badge-icon']);
    expect(status.querySelectorAll('.check').length).toBe(1);
    expect(status.getAttribute('data-variant')).toBe('outline');
    expect(status.getAttribute('data-size')).toBe('lg');
    expect(status.getAttribute('data-icon-alignment')).toBe('end');
    expect(s.errors).toEqual([]);
  });

  it('works as a standalone import and leaves the colour to the app theme', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlanBadgeComponent);
    const app = fixture.componentInstance;
    const badge = (fixture.nativeElement as HTMLElement).querySelector('et-badge')!;

    s.tick();

    expect(app.badge().variant()).toBe('outline');
    expect(app.badge().size()).toBe('lg');
    expect(badge.getAttribute('data-size')).toBe('lg');
    expect(badge.classList).not.toContain('et-color--positive');

    app.variant.set(BADGE_VARIANTS.FILLED);
    s.tick();

    expect(badge.getAttribute('data-variant')).toBe('filled');
  });
});
