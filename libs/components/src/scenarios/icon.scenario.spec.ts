import { Component, Directive, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ALIGN_CENTER_ICON,
  ALIGN_JUSTIFY_ICON,
  ALIGN_LEFT_ICON,
  ALIGN_RIGHT_ICON,
  ARROW_OUT_UP_RIGHT_ICON,
  ARROW_RIGHT_ICON,
  ARROW_UP_ICON,
  ARROWS_LEFT_RIGHT_ICON,
  BOLD_ICON,
  CALENDAR_ICON,
  CHECK_ICON,
  CHEVRON_ICON,
  CIRCLE_CHECK_ICON,
  CIRCLE_INFO_ICON,
  CLIPBOARD_CHECK_ICON,
  CLOCK_ICON,
  CODE_BLOCK_ICON,
  CODE_ICON,
  DEFAULT_ICON_VARIANT,
  ELLIPSIS_ICON,
  ELLIPSIS_VERTICAL_ICON,
  ET_BUILT_IN_ICON_NAMES,
  EYE_ICON,
  EYE_SLASH_ICON,
  EYEDROPPER_ICON,
  FILE_ICON,
  FILTER_ICON,
  FLOPPY_DISK_ICON,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  HEADING_1_ICON,
  HEADING_2_ICON,
  HEADING_3_ICON,
  ICON_DIRECTIVE_TOKEN,
  ICON_ERROR_CODES,
  ICON_IMPORTS,
  ICON_OVERRIDES_TOKEN,
  IconDefinition,
  IconDirective,
  iconRegistryKey,
  ICONS_TOKEN,
  IMAGE_ICON,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  LOCATION_ICON,
  LOCK_ICON,
  MINUS_ICON,
  PARAGRAPH_ICON,
  PAUSE_ICON,
  PENCIL_ICON,
  PLAY_ICON,
  PLUS_ICON,
  provideIconOverrides,
  provideIcons,
  QUOTE_ICON,
  REDO_ICON,
  ROTATE_RIGHT_ICON,
  STAR_ICON,
  STRIKETHROUGH_ICON,
  TABLE_ICON,
  THUMBTACK_ICON,
  TIMES_ICON,
  TRASH_ICON,
  TRIANGLE_EXCLAMATION_ICON,
  TROPHY_ICON,
  UNDERLINE_ICON,
  UNDO_ICON,
  UPLOAD_ICON,
} from '../index';
import { useScenario } from './harness';

const BUILT_IN_ICONS: IconDefinition[] = [
  ALIGN_CENTER_ICON,
  ALIGN_JUSTIFY_ICON,
  ALIGN_LEFT_ICON,
  ALIGN_RIGHT_ICON,
  ARROW_OUT_UP_RIGHT_ICON,
  ARROW_RIGHT_ICON,
  ARROW_UP_ICON,
  ARROWS_LEFT_RIGHT_ICON,
  BOLD_ICON,
  CALENDAR_ICON,
  CHECK_ICON,
  CHEVRON_ICON,
  CIRCLE_CHECK_ICON,
  CIRCLE_INFO_ICON,
  CLIPBOARD_CHECK_ICON,
  CLOCK_ICON,
  CODE_BLOCK_ICON,
  CODE_ICON,
  ELLIPSIS_ICON,
  ELLIPSIS_VERTICAL_ICON,
  EYE_ICON,
  EYE_SLASH_ICON,
  EYEDROPPER_ICON,
  FILE_ICON,
  FILTER_ICON,
  FLOPPY_DISK_ICON,
  FOCUS_FRAME_ICON,
  GRID_2X2_ICON,
  HEADING_1_ICON,
  HEADING_2_ICON,
  HEADING_3_ICON,
  IMAGE_ICON,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  LOCATION_ICON,
  LOCK_ICON,
  MINUS_ICON,
  PARAGRAPH_ICON,
  PAUSE_ICON,
  PENCIL_ICON,
  PLAY_ICON,
  PLUS_ICON,
  QUOTE_ICON,
  REDO_ICON,
  ROTATE_RIGHT_ICON,
  STAR_ICON,
  STRIKETHROUGH_ICON,
  TABLE_ICON,
  THUMBTACK_ICON,
  TIMES_ICON,
  TRASH_ICON,
  TRIANGLE_EXCLAMATION_ICON,
  TROPHY_ICON,
  UNDERLINE_ICON,
  UNDO_ICON,
  UPLOAD_ICON,
];

const svg = (viewBox: string, paint = 'fill="currentColor"') =>
  `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path ${paint} d="M0 0h1v1z"/></svg>`;

const SHIELD_SOLID: IconDefinition = { name: 'shield', variant: 'solid', data: svg('0 0 10 10') };
const SHIELD_LIGHT: IconDefinition = { name: 'shield', variant: 'light', data: svg('0 0 20 20') };
const BRAND_LOGO: IconDefinition = {
  name: 'brand-logo',
  data: svg('0 0 30 30', 'fill="#ff0000"'),
};

@Component({
  selector: 'et-scenario-icon-gallery',
  imports: [ICON_IMPORTS],
  providers: [provideIcons(...BUILT_IN_ICONS)],
  template: `
    @for (name of names; track name) {
      <span [etIcon]="name" [attr.data-name]="name"></span>
    }
  `,
})
class IconGalleryComponent {
  names = ET_BUILT_IN_ICON_NAMES;
}

@Directive({ selector: '[etScenarioIconProbe]' })
class IconProbeDirective {
  icon = inject(ICON_DIRECTIVE_TOKEN);
}

@Component({
  selector: 'et-scenario-status-cell',
  imports: [IconDirective, IconProbeDirective],
  providers: [provideIcons(SHIELD_SOLID, SHIELD_LIGHT, CHECK_ICON, BRAND_LOGO)],
  template: `
    <span [etIcon]="name()" [variant]="variant()" [label]="label()" class="status" etScenarioIconProbe></span>
    <span class="logo" etIcon="brand-logo" allowHardcodedColor></span>
  `,
})
class StatusCellComponent {
  name = signal('shield');
  variant = signal<string | undefined>(undefined);
  label = signal<string | null>(null);
  registry = inject(ICONS_TOKEN);
}

@Component({
  selector: 'et-scenario-close-bar',
  imports: [ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  template: `
    <span class="chevron" etIcon="et-chevron"></span>
    <span class="times" etIcon="et-times"></span>
    <span class="brand" etIcon="brand-mark"></span>
  `,
})
class CloseBarComponent {
  overrides = inject(ICON_OVERRIDES_TOKEN);
}

@Component({
  selector: 'et-scenario-unregistered',
  imports: [ICON_IMPORTS],
  template: `<span etIcon="et-check"></span>`,
})
class UnregisteredComponent {}

@Component({
  selector: 'et-scenario-broken-icon',
  imports: [ICON_IMPORTS],
  providers: [
    provideIcons(
      CHECK_ICON,
      { name: 'not-svg', data: '<img src="x.png">' },
      { name: 'no-xmlns', data: '<svg width="100%" height="100%" viewBox="0 0 1 1"></svg>' },
      { name: 'no-size', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>' },
      { name: 'painted', data: svg('0 0 1 1', 'stroke="#000"') },
    ),
  ],
  template: `<span [etIcon]="name()"></span>`,
})
class BrokenIconComponent {
  name = signal('et-check');
}

const query = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const viewBoxOf = (element: HTMLElement) => element.querySelector('svg')?.getAttribute('viewBox');

describe('icon scenarios', () => {
  const scenario = useScenario();

  it('ships a definition for every built-in icon name and renders each through etIcon', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(IconGalleryComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(BUILT_IN_ICONS.map((icon) => icon.name).sort()).toEqual([...ET_BUILT_IN_ICON_NAMES].sort());

    for (const icon of BUILT_IN_ICONS) {
      const element = query(host, `[data-name="${icon.name}"]`);

      expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe(
        new DOMParser().parseFromString(icon.data, 'image/svg+xml').documentElement.getAttribute('viewBox'),
      );
      expect(element.classList.contains(`et-icon--${icon.name}`)).toBe(true);
      expect(element.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('picks the default variant, switches variant and name reactively, and names a meaningful icon', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StatusCellComponent);
    const host = fixture.nativeElement as HTMLElement;
    const cell = fixture.componentInstance;

    s.tick();

    const status = query(host, '.status');

    expect(DEFAULT_ICON_VARIANT).toBe(SHIELD_SOLID.variant);
    expect(viewBoxOf(status)).toBe('0 0 10 10');
    expect(status.className).toBe('status et-icon et-icon--shield');
    expect(cell.registry[iconRegistryKey('shield', 'light')]).toBe(SHIELD_LIGHT);
    expect(cell.registry[iconRegistryKey('et-check')]).toBe(CHECK_ICON);

    cell.variant.set('light');
    s.tick();
    expect(viewBoxOf(status)).toBe('0 0 20 20');
    expect(status.classList.contains('et-icon--shield--light')).toBe(true);

    cell.name.set('et-check');
    cell.variant.set(undefined);
    cell.label.set('Verified');
    s.tick();

    const probe = fixture.debugElement.children[0]?.injector.get(IconProbeDirective);

    expect(probe?.icon.iconNameToUse()).toBe('et-check');
    expect(viewBoxOf(status)).toBe('0 0 448 512');
    expect(status.getAttribute('role')).toBe('img');
    expect(status.getAttribute('aria-label')).toBe('Verified');
    expect(status.hasAttribute('aria-hidden')).toBe(false);

    cell.label.set(null);
    s.tick();
    expect(status.getAttribute('aria-hidden')).toBe('true');
    expect(status.hasAttribute('role')).toBe(false);

    expect(viewBoxOf(query(host, '.logo'))).toBe('0 0 30 30');
  });

  it('throws when an icon is rendered without any registered icons', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(UnregisteredComponent)).toThrow(`ET${ICON_ERROR_CODES.NO_ICONS_PROVIDED}`);
    s.tick();
  });

  it('rejects duplicate registrations', () => {
    scenario();

    expect(() => provideIcons(CHECK_ICON, { ...CHECK_ICON })).toThrow(`ET${ICON_ERROR_CODES.DUPLICATE_ICON_NAME}`);
    expect(() => provideIconOverrides(CHECK_ICON, CHECK_ICON)).toThrow(`ET${ICON_ERROR_CODES.DUPLICATE_ICON_NAME}`);
    expect(() => provideIcons(SHIELD_SOLID, SHIELD_LIGHT)).not.toThrow();
  });

  it.each([
    ['missing-icon', ICON_ERROR_CODES.ICON_NOT_FOUND],
    ['not-svg', ICON_ERROR_CODES.INVALID_SVG],
    ['no-xmlns', ICON_ERROR_CODES.MISSING_XMLNS],
    ['no-size', ICON_ERROR_CODES.MISSING_DIMENSIONS],
    ['painted', ICON_ERROR_CODES.HARDCODED_COLOR],
  ])('reports the broken icon "%s"', (name, code) => {
    const s = scenario();
    const fixture = TestBed.createComponent(BrokenIconComponent);

    s.tick();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();

    fixture.componentInstance.name.set(name);
    expect(() => s.tick()).toThrow(`ET${code}`);
  });
});

describe('icon override scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideIconOverrides(
        { name: 'et-chevron', data: svg('0 0 99 99') },
        { name: 'brand-mark', data: svg('0 0 7 7') },
      ),
    ],
  });

  it('replaces a built-in icon app-wide, keeps the others, and adds new names', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CloseBarComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(Object.keys(fixture.componentInstance.overrides)).toEqual(['et-chevron', 'brand-mark']);
    expect(viewBoxOf(query(host, '.chevron'))).toBe('0 0 99 99');
    expect(viewBoxOf(query(host, '.times'))).toBe(
      new DOMParser().parseFromString(TIMES_ICON.data, 'image/svg+xml').documentElement.getAttribute('viewBox'),
    );
    expect(viewBoxOf(query(host, '.brand'))).toBe('0 0 7 7');
  });

  it('reports an icon that neither the component nor the overrides register', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(UnregisteredComponent);

    expect(() => s.tick()).toThrow(`ET${ICON_ERROR_CODES.ICON_NOT_FOUND}`);
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });
});
