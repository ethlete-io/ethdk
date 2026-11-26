import { DOCUMENT, PlatformLocation } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  Binding,
  Component,
  ComponentRef,
  createComponent,
  Directive,
  effect,
  EnvironmentInjector,
  inject,
  inputBinding,
  Injector,
  OutputRef,
  outputBinding,
  reflectComponentType,
  Type,
  signal,
  untracked,
  viewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { outputToObservable, toSignal } from '@angular/core/rxjs-interop';
import { injectOverlayManager, OVERLAY_REF, OverlayRef } from '@ethlete/components';
import { injectRenderer } from '@ethlete/core';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { WINDOW_CHROME, WindowChrome } from '../../host/window';
import { DESIGN_HARNESS_PARTS } from './design-harness-parts';
import {
  DESIGN_HARNESS_DIALOGS,
  DESIGN_HARNESS_PROVIDERS,
  DESIGN_HARNESS_SAMPLES,
  DESIGN_HARNESS_TEMPLATES,
  DesignHarnessDialog,
} from './design-harness-samples';

/** Each output a mounted part emits, in order, for `et design actions` to read. */
export type HarnessEmits = { output: string; value: unknown }[];

const LINUX_CHROME: WindowChrome = {
  os: 'linux',
  left: [],
  right: ['minimize', 'maximize', 'close'],
  preferNoCsd: false,
};

type HarnessState = { part: string; component: Type<unknown>; props: Record<string, unknown> } | { error: string };

@Directive({ selector: '[ethleteDesignHarnessMounted]', host: { 'data-design-harness-mounted': '' } })
export class DesignHarnessMountedDirective {}

const stateOf$ = (search: string): Observable<HarnessState> => {
  const params = new URLSearchParams(search);
  const part = params.get('part') ?? '';
  const load = Object.hasOwn(DESIGN_HARNESS_PARTS, part) ? DESIGN_HARNESS_PARTS[part] : undefined;

  if (!load) return of({ error: `Unknown design part "${part}".` });

  let props: unknown;

  try {
    props = JSON.parse(params.get('props') ?? '{}') ?? {};
  } catch (error) {
    return of({ error: `The props of "${part}" are not JSON: ${String(error)}` });
  }

  if (typeof props !== 'object' || Array.isArray(props)) return of({ error: `The props of "${part}" are no object.` });

  return from(load()).pipe(
    map((component) => ({
      part,
      component,
      props: (DESIGN_HARNESS_SAMPLES[part] ?? ((own) => own))(props as Record<string, unknown>),
    })),
    catchError((error: unknown) => of({ error: `"${part}" did not load: ${String(error)}` })),
  );
};

const declaredInputsOf = (component: Type<unknown>) =>
  new Set(reflectComponentType(component)?.inputs.map(({ templateName }) => templateName));

const dialogOf = (search: string) => {
  const part = new URLSearchParams(search).get('part') ?? '';

  return Object.hasOwn(DESIGN_HARNESS_DIALOGS, part) ? DESIGN_HARNESS_DIALOGS[part] : undefined;
};

@Component({
  selector: 'ethlete-root',
  template: `
    @let current = state();

    @if (current && 'error' in current) {
      <p data-design-harness-error>{{ current.error }}</p>
    } @else if (current) {
      <div [class]="hostClass" data-design-harness-host>
        @if (dialog && !dialog.stage) {
          <div class="size-full"></div>
        }
        <ng-container #outlet />
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DesignHarnessComponent {
  private platformLocation = inject(PlatformLocation);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private injector = inject(Injector);
  private appRef = inject(ApplicationRef);
  private environmentInjector = inject(EnvironmentInjector);
  private overlay = injectOverlayManager();
  private outlet = viewChild('outlet', { read: ViewContainerRef });
  private templatesRef: ComponentRef<{ templates: () => Record<string, unknown> }> | null = null;
  private dialogRef: OverlayRef<object> | null = null;
  protected state = toSignal(stateOf$(this.platformLocation.search));
  protected dialog = dialogOf(this.platformLocation.search);
  protected hostClass = this.dialog
    ? 'block h-screen w-screen bg-et-surface-background'
    : new URLSearchParams(this.platformLocation.search).get('layout') === 'page'
      ? 'block min-h-screen w-screen'
      : 'flow-root w-fit';

  constructor() {
    effect(() => {
      const outlet = this.outlet();
      const state = this.state();

      if (!outlet || !state || 'error' in state) return;

      untracked(() => {
        outlet.clear();
        this.templatesRef?.destroy();
        this.templatesRef = null;
        this.dialogRef?.close();
        this.dialogRef = null;

        const injector = Injector.create({
          parent: this.injector,
          providers: [
            ...(this.dialog
              ? []
              : [
                  {
                    provide: OVERLAY_REF,
                    useValue: { close: () => undefined, busy: signal(false) } as unknown as OverlayRef,
                  },
                ]),
            { provide: WINDOW_CHROME, useValue: signal(LINUX_CHROME).asReadonly() },
            ...((Object.hasOwn(DESIGN_HARNESS_PROVIDERS, state.part) && DESIGN_HARNESS_PROVIDERS[state.part]) || []),
          ],
        });
        const inputs = Object.entries({ ...this.templatesOf(state.part, injector), ...state.props });
        const emits = this.recordedEmits();

        if (this.dialog) {
          this.openDialog({ dialog: this.dialog, outlet, injector, component: state.component, inputs, emits });

          return;
        }

        const ref = outlet.createComponent(state.component, { injector });
        const declared = declaredInputsOf(state.component);

        inputs.forEach(([name, value]) => {
          if (name === 'class') {
            if (typeof value === 'string')
              value
                .split(/\s+/)
                .filter(Boolean)
                .forEach((name) => this.renderer.addClass(ref.location.nativeElement, name));

            return;
          }

          if (declared.has(name)) ref.setInput(name, value);
        });

        this.recordOutputs({ component: state.component, instance: ref.instance as Record<string, unknown>, emits });
      });
    });
  }

  private openDialog(options: {
    dialog: DesignHarnessDialog;
    outlet: ViewContainerRef;
    injector: Injector;
    component: Type<unknown>;
    inputs: [string, unknown][];
    emits: HarnessEmits;
  }) {
    const { dialog, outlet, injector, component, inputs, emits } = options;
    const stage = dialog.stage ? outlet.createComponent(dialog.stage, { injector }) : null;

    const mirror = reflectComponentType(component);
    const declared = declaredInputsOf(component);
    const bindings: Binding[] = [
      ...inputs.filter(([name]) => declared.has(name)).map(([name, value]) => inputBinding(name, () => value)),
      ...(mirror?.outputs ?? []).map(({ templateName }) =>
        outputBinding<unknown>(templateName, (value) => emits.push({ output: templateName, value })),
      ),
    ];

    afterNextRender(
      () => {
        this.dialogRef = this.overlay.open(component as Type<object>, {
          ...dialog.config(stage?.instance.origin() ?? null),
          autoFocus: false,
          injector,
          bindings,
          directives: [DesignHarnessMountedDirective],
        });
      },
      { injector: this.injector },
    );
  }

  private recordedEmits() {
    const emits: HarnessEmits = [];

    if (this.document.defaultView) Reflect.set(this.document.defaultView, '__etDesignEmits', emits);

    return emits;
  }

  private templatesOf(part: string, elementInjector: Injector) {
    const component = Object.hasOwn(DESIGN_HARNESS_TEMPLATES, part) ? DESIGN_HARNESS_TEMPLATES[part] : undefined;

    if (!component) return {};

    this.templatesRef = createComponent(component, {
      environmentInjector: this.environmentInjector,
      elementInjector,
    });
    this.appRef.attachView(this.templatesRef.hostView);
    this.templatesRef.changeDetectorRef.detectChanges();

    return this.templatesRef.instance.templates();
  }

  private recordOutputs(options: { component: Type<unknown>; instance: Record<string, unknown>; emits: HarnessEmits }) {
    const { component, instance, emits } = options;

    for (const { propName, templateName } of reflectComponentType(component)?.outputs ?? []) {
      const output = instance[propName] as OutputRef<unknown> | undefined;

      if (output)
        outputToObservable(output)
          .pipe(tap((value) => emits.push({ output: templateName, value })))
          .subscribe();
    }
  }
}
