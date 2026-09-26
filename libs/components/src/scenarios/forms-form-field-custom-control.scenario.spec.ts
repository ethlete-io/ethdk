import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  Directive,
  ElementRef,
  inject,
  inputBinding,
  model,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { AnimatableDirective, provideColorThemes, ProvideColorDirective } from '@ethlete/core';
import { Subject } from 'rxjs';
import {
  ACCESSIBLE_NAME_INPUTS,
  AccessibleNameControlDirective,
  anchoredOverlayStrategy,
  type AnchoredPanelOverlayRef,
  clearLeavingSupportStateOnExit,
  ControlSuffixDirective,
  createAnchoredPanelController,
  FIELD_WARNINGS,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_TOKEN,
  FormErrorComponent,
  FormFieldBarrierDirective,
  type FormFieldControl,
  FormFieldDirective,
  FormWarningComponent,
  hitsInteractiveElement,
  INITIAL_SUPPORT_PRESENTATION_STATE,
  injectFormSupport,
  injectOverlaySurfaceContext,
  INPUT_IMPORTS,
  INTERACTIVE_TAGS,
  isInteractiveElement,
  provideFormSupport,
  provideOverlay,
  reduceSupportPresentation,
  registerSingleton,
  SUPPORT_CONTENT_STATE,
  SUPPORT_TRANSITION_DIRECTION,
  supportPresentationIncludesState,
  TEXT_FIELD_CONTROL_INPUTS,
  TextFieldControlDirective,
  toFieldWarnings,
  warn,
  wireFormSupport,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Directive({ selector: '[etScenarioSlug]' })
class SlugDirective extends TextFieldControlDirective {
  value = model('');
  controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);
  hasValue = computed(() => !!this.value());
}

@Component({
  selector: 'et-scenario-slug-input',
  imports: [ControlSuffixDirective, FormFieldBarrierDirective, INPUT_IMPORTS],
  hostDirectives: [
    {
      directive: SlugDirective,
      inputs: ['value', ...TEXT_FIELD_CONTROL_INPUTS],
      outputs: ['valueChange', 'touchedChange', 'touch'],
    },
  ],
  template: `
    <input
      #native
      [value]="slug.value()"
      [disabled]="slug.disabled()"
      [attr.aria-labelledby]="slug.labelId()"
      [attr.aria-label]="slug.ariaLabel()"
      [attr.aria-describedby]="slug.describedBy()"
      [attr.aria-invalid]="slug.shouldDisplayError() || null"
      (input)="slug.value.set(native.value.toLowerCase())"
      (focus)="slug.focused.set(true)"
      (blur)="slug.focused.set(false); slug.touched.set(true)"
      class="slug-native"
    />
    <span etFormFieldBarrier>
      <et-input [(value)]="domain" aria-label="Domain" />
    </span>
    <ng-template etControlSuffix>
      <button (click)="slug.value.set('')" class="slug-clear" type="button">Clear slug</button>
    </ng-template>
  `,
})
class SlugInputComponent {
  slug = inject(SlugDirective);
  domain = signal('example.com');
  native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  constructor() {
    afterNextRender(() => this.slug.focusTarget.set(this.native().nativeElement));
  }
}

@Component({
  selector: 'et-scenario-caption',
  template: '<ng-content />',
  host: { '[id]': 'id()' },
})
class CaptionComponent {
  id = signal(`caption-${Math.random().toString(36).slice(2)}`);

  constructor() {
    registerSingleton(inject(FORM_FIELD_TOKEN, { optional: true })?.registeredLabel, this);
  }
}

@Directive({ selector: '[etScenarioChip]' })
class ChipDirective extends AccessibleNameControlDirective implements FormFieldControl {
  private field = inject(FORM_FIELD_TOKEN, { optional: true });
  pressed = model(false);
  touched = signal(false);
  invalid = signal(false);
  errors = signal([]);
  name = signal('chip');
  describedBy = signal<string | null>(null);
  controlType = signal(FORM_FIELD_CONTROL_TYPES.SWITCH);
  warnings = computed(() => (this.pressed() ? 'Turning this on notifies everyone.' : null));

  constructor() {
    super();
    this.field?.registerControl(this);
  }

  activate() {
    this.pressed.set(!this.pressed());
  }
}

@Component({
  selector: 'et-scenario-chip-toggle',
  hostDirectives: [
    { directive: ChipDirective, inputs: ['pressed', ...ACCESSIBLE_NAME_INPUTS], outputs: ['pressedChange'] },
  ],
  template: `
    <button
      [attr.aria-pressed]="chip.pressed()"
      [attr.aria-label]="chip.ariaLabel()"
      [attr.aria-labelledby]="chip.labelId()"
      [attr.aria-describedby]="chip.describedBy()"
      (click)="chip.activate()"
      class="chip-button"
      type="button"
    >
      chip
    </button>
  `,
})
class ChipToggleComponent {
  chip = inject(ChipDirective);
}

@Component({
  selector: 'et-scenario-plain-field',
  imports: [AnimatableDirective, FormErrorComponent, FormWarningComponent, NgTemplateOutlet],
  hostDirectives: [FormFieldDirective],
  providers: [provideFormSupport()],
  template: `
    <div (mousedown)="frameDown($event)" class="plain-frame">
      <ng-content />
    </div>
    <div class="plain-suffix">
      <ng-container [ngTemplateOutlet]="field.controlSuffixTemplate()" />
    </div>
    @if (support.shouldRenderError()) {
      <p #errorContent #errorAnimatable="etAnimatable" [id]="support.errorId()" class="plain-errors" etAnimatable>
        @for (error of support.visibleErrors(); track $index) {
          <et-form-error [error]="error" />
        }
      </p>
    }
    @if (support.shouldRenderWarning()) {
      <p
        #warningContent
        #warningAnimatable="etAnimatable"
        [id]="support.warningId()"
        class="plain-warnings"
        etAnimatable
      >
        @for (warning of support.visibleWarnings(); track $index) {
          <et-form-warning [warning]="warning" />
        }
      </p>
    }
    @if (support.shouldRenderHint()) {
      <p #hintContent #hintAnimatable="etAnimatable" [id]="support.hintId()" class="plain-hint" etAnimatable>
        <ng-content select="et-hint" />
      </p>
    }
  `,
})
class PlainFieldComponent {
  support = injectFormSupport();
  field = inject(FormFieldDirective);
  errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  warningContent = viewChild<ElementRef<HTMLElement>>('warningContent');
  hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  warningAnimatable = viewChild<AnimatableDirective>('warningAnimatable');
  hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');
  frameActivations = 0;

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContent,
      warningContent: this.warningContent,
      hintContent: this.hintContent,
      errorAnimatable: this.errorAnimatable,
      warningAnimatable: this.warningAnimatable,
      hintAnimatable: this.hintAnimatable,
    });
  }

  frameDown(event: MouseEvent) {
    if (hitsInteractiveElement(event.target as HTMLElement, event.currentTarget as HTMLElement)) return;

    this.frameActivations++;
    this.field.activate();
  }
}

@Component({
  selector: 'et-scenario-settings',
  imports: [
    FORM_FIELD_IMPORTS,
    FormField,
    SlugInputComponent,
    CaptionComponent,
    ChipToggleComponent,
    PlainFieldComponent,
  ],
  template: `
    <et-form-field>
      <et-label>Slug</et-label>
      <et-scenario-slug-input [formField]="settings.slug" />
      <et-hint>Lowercase only.</et-hint>
    </et-form-field>

    <et-form-field>
      @if (captioned()) {
        <et-scenario-caption class="first-caption">Notify</et-scenario-caption>
      } @else {
        <et-scenario-caption class="second-caption">Alert</et-scenario-caption>
      }
      <et-scenario-chip-toggle [(pressed)]="notify" />
    </et-form-field>

    <et-scenario-plain-field>
      <et-scenario-slug-input [formField]="settings.handle" aria-label="Handle" />
      <span class="plain-decoration">decoration</span>
      <et-hint>Shown on your profile.</et-hint>
    </et-scenario-plain-field>
  `,
})
class SettingsComponent {
  model = signal({ slug: '', handle: 'me' });
  settings = form(this.model, (path) => {
    required(path.slug, { message: 'Pick a slug' });
    required(path.handle, { message: 'Pick a handle' });
    warn(path.handle, ({ value }) => (value().length < 3 ? 'Short handles are hard to find.' : null));
  });
  captioned = signal(true);
  notify = signal(false);
  plain = viewChild.required(PlainFieldComponent);
}

@Component({
  selector: 'et-scenario-swatch-panel',
  hostDirectives: [ProvideColorDirective],
  template: '<div #panelBody class="swatch-panel-body"><ng-content /></div>',
})
class SwatchPanelComponent {
  panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  constructor() {
    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'swatch-panel--resizing' });
  }
}

@Component({
  selector: 'et-scenario-swatch-picker',
  imports: [SwatchPanelComponent],
  template: `
    <button #anchor [attr.aria-expanded]="open()" (click)="open.set(!open())" class="swatch-trigger" type="button">
      {{ value() }}
    </button>
    <ng-template #surface let-close="close">
      <et-scenario-swatch-panel>
        <button (click)="value.set('teal'); close()" class="swatch-option" type="button">teal</button>
      </et-scenario-swatch-panel>
    </ng-template>
    <button class="swatch-elsewhere" type="button">elsewhere</button>
  `,
})
class SwatchPickerComponent {
  value = signal('none');
  open = signal(false);
  disabled = signal(false);
  overlayRef = signal<AnchoredPanelOverlayRef | null>(null);
  anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  surfaceRef = viewChild.required<TemplateRef<unknown>>('surface');
  closes: { byOutsidePointer: boolean; byFocusLeave: boolean }[] = [];

  panel = createAnchoredPanelController({
    canOpen: computed(() => !this.disabled()),
    open: this.open,
    overlayRef: this.overlayRef,
    surface: computed(() => ({ templateRef: this.surfaceRef() })),
    anchor: () => this.anchor().nativeElement,
    config: ({ origin, templateRef }) => ({
      bindings: [
        inputBinding('template', () => templateRef),
        inputBinding('context', () => ({ close: () => this.open.set(false) })),
      ],
      mode: 'non-modal',
      autoFocus: false,
      restoreFocus: false,
      closeOnEscape: false,
      closeOnOutsidePointer: false,
      origin,
      panelClass: 'swatch-pane',
      strategies: anchoredOverlayStrategy({ containerClass: 'swatch-anchored', placement: 'bottom-start' }),
    }),
    onAfterClosed: (info) =>
      this.closes.push({ byOutsidePointer: info.byOutsidePointer, byFocusLeave: info.byFocusLeave }),
  });
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const render = (s: Scenario) => {
  s.tick();
  s.flush();
};

const describedBy = (control: Element) => {
  const id = control.getAttribute('aria-describedby');

  return id ? document.getElementById(id) : null;
};

const type = (s: Scenario, field: HTMLInputElement, text: string) => {
  field.focus();
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

describe('forms form-field custom control scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('wires a consumer control built on TextFieldControlDirective into the field like a built-in one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SettingsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const settings = fixture.componentInstance;

    render(s);

    const slugField = query('et-form-field', host);
    const native = query<HTMLInputElement>('.slug-native', slugField);

    expect(native.getAttribute('aria-labelledby')).toBe(query('et-label', slugField).id);
    expect(query('.et-label-required-marker', slugField)).toBeTruthy();
    expect(describedBy(native)?.textContent).toContain('Lowercase only.');
    expect(slugField.getAttribute('data-control-type')).toBe(FORM_FIELD_CONTROL_TYPES.TEXT_INPUT);

    const domain = query<HTMLInputElement>('et-input input', slugField);

    expect(domain.getAttribute('aria-label')).toBe('Domain');
    expect(domain.hasAttribute('aria-describedby')).toBe(false);

    const clear = query('.slug-clear', slugField);

    expect(clear.closest('.et-form-field-suffix')).not.toBeNull();

    type(s, native, 'My-Page');
    expect(settings.model().slug).toBe('my-page');
    expect(slugField.hasAttribute('data-label-floated')).toBe(false);

    clear.click();
    native.blur();
    render(s);

    expect(settings.model().slug).toBe('');
    expect(settings.settings.slug().touched()).toBe(true);
    expect(describedBy(native)?.textContent).toContain('Pick a slug');
    expect(native.getAttribute('aria-invalid')).toBe('true');

    query('et-label', slugField).click();
    s.tick();
    expect(document.activeElement).toBe(native);
    render(s);
  });

  it('names a control through a consumer caption registered as the single label, and swaps it cleanly', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SettingsComponent);
    const host = fixture.nativeElement as HTMLElement;

    render(s);

    const chipField = host.querySelectorAll('et-form-field')[1] as HTMLElement;
    const chip = query('.chip-button', chipField);

    expect(chip.getAttribute('aria-labelledby')).toBe(query('.first-caption', chipField).id);
    expect(s.errors).toEqual([]);

    fixture.componentInstance.captioned.set(false);
    render(s);
    expect(chip.getAttribute('aria-labelledby')).toBe(query('.second-caption', chipField).id);

    chip.click();
    render(s);

    expect(fixture.componentInstance.notify()).toBe(true);
    expect(describedBy(chip)?.textContent).toContain('Turning this on notifies everyone.');
    expect(chipField.getAttribute('data-control-type')).toBe(FORM_FIELD_CONTROL_TYPES.SWITCH);
    expect(chipField.hasAttribute('data-text-shell')).toBe(false);
  });

  it('drives a consumer-built field chrome from injectFormSupport and forwards blank-frame clicks only', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SettingsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const settings = fixture.componentInstance;

    render(s);

    const plain = query('et-scenario-plain-field', host);
    const native = query<HTMLInputElement>('.slug-native', plain);
    const support = settings.plain().support;

    expect(native.getAttribute('aria-label')).toBe('Handle');
    expect(native.hasAttribute('aria-labelledby')).toBe(false);
    expect(describedBy(native)?.classList).toContain('plain-warnings');
    expect(query('et-form-warning', plain).textContent).toContain('Short handles are hard to find.');
    expect(support.semanticSupportState()).toBe(SUPPORT_CONTENT_STATE.WARNING);
    expect(settings.settings.handle().metadata(FIELD_WARNINGS)?.()).toEqual(
      toFieldWarnings('Short handles are hard to find.'),
    );

    type(s, native, 'handle');
    render(s);
    expect(describedBy(native)?.classList).toContain('plain-hint');
    expect(support.hintActive()).toBe(true);

    type(s, native, '');
    native.blur();
    render(s);
    expect(describedBy(native)?.textContent).toContain('Pick a handle');
    expect(support.displaysError()).toBe(true);

    query('.plain-decoration', plain).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    s.tick();
    expect(settings.plain().frameActivations).toBe(1);
    expect(document.activeElement).toBe(native);

    native.blur();
    native.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    query('et-input input', plain).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(settings.plain().frameActivations).toBe(1);
    expect(INTERACTIVE_TAGS).toContain(native.tagName);
    expect(isInteractiveElement(query('.plain-decoration', plain))).toBeFalsy();
    expect(isInteractiveElement(native)).toBe(true);

    type(s, native, 'handle');
    render(s);
    const clear = query<HTMLButtonElement>('.plain-suffix .slug-clear', plain);
    clear.click();
    render(s);
    expect(native.value).toBe('');
    expect(settings.plain().frameActivations).toBe(1);
  });

  it('opens a consumer picker panel through createAnchoredPanelController and closes it on an outside pointer', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SwatchPickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const picker = fixture.componentInstance;

    render(s);

    query('.swatch-trigger', host).click();
    render(s);

    const pane = picker.overlayRef()?.elements?.paneElement;

    expect(pane?.classList).toContain('swatch-pane');
    expect(query('.swatch-trigger', host).getAttribute('aria-expanded')).toBe('true');
    expect(query('et-scenario-swatch-panel', pane).classList).toContain('et-color--inherited');

    query('.swatch-option', pane).click();
    render(s);

    expect(picker.value()).toBe('teal');
    expect(picker.overlayRef()).toBeNull();
    expect(picker.closes).toEqual([{ byOutsidePointer: false, byFocusLeave: false }]);

    picker.open.set(true);
    render(s);
    query('.swatch-elsewhere', host).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    render(s);

    expect(picker.open()).toBe(false);
    expect(picker.overlayRef()).toBeNull();
    expect(picker.closes[1]).toEqual({ byOutsidePointer: true, byFocusLeave: false });

    picker.disabled.set(true);
    picker.open.set(true);
    render(s);
    expect(picker.open()).toBe(false);
    expect(picker.overlayRef()).toBeNull();
  });

  it('reduces the support presentation so a replaced message animates out in the right direction', () => {
    const s = scenario();
    const hinting = reduceSupportPresentation({
      presentation: INITIAL_SUPPORT_PRESENTATION_STATE,
      semanticSupportState: SUPPORT_CONTENT_STATE.HINT,
      errors: [],
      warnings: [],
    });
    const erroring = reduceSupportPresentation({
      presentation: hinting,
      semanticSupportState: SUPPORT_CONTENT_STATE.ERROR,
      errors: [{ kind: 'required', message: 'Required' }],
      warnings: [],
    });

    expect(erroring.leavingState).toBe(SUPPORT_CONTENT_STATE.HINT);
    expect(erroring.directions.hint).toBe(SUPPORT_TRANSITION_DIRECTION.TO_ABOVE);
    expect(erroring.directions.error).toBe(SUPPORT_TRANSITION_DIRECTION.FROM_BELOW);
    expect(supportPresentationIncludesState({ presentation: erroring, state: SUPPORT_CONTENT_STATE.HINT })).toBe(true);

    const consumer = s.consumer();
    const presentation = signal(erroring);
    const animationEnd$ = new Subject<void>();
    const animatable = signal({ animationEnd$ } as unknown as AnimatableDirective);

    consumer.run(() =>
      clearLeavingSupportStateOnExit({
        state: SUPPORT_CONTENT_STATE.HINT,
        animatable,
        presentation,
        semanticSupportState: signal(SUPPORT_CONTENT_STATE.ERROR),
      }),
    );
    s.tick();

    animationEnd$.next();
    s.tick();

    expect(presentation().leavingState).toBe(SUPPORT_CONTENT_STATE.NONE);
    expect(supportPresentationIncludesState({ presentation: presentation(), state: SUPPORT_CONTENT_STATE.HINT })).toBe(
      false,
    );
    consumer.destroy();
  });
});
