import { DOCUMENT, PlatformLocation } from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  effect,
  EnvironmentInjector,
  inject,
  Injector,
  OutputRef,
  reflectComponentType,
  Type,
  signal,
  untracked,
  viewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { outputToObservable, toSignal } from '@angular/core/rxjs-interop';
import { OVERLAY_REF, OverlayRef } from '@ethlete/components';
import { injectRenderer } from '@ethlete/core';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { WINDOW_CHROME, WindowChrome } from '../../host/window';
import { DESIGN_HARNESS_PARTS } from './design-harness-parts';
import { DESIGN_HARNESS_SAMPLES, DESIGN_HARNESS_TEMPLATES } from './design-harness-samples';

/** Each output a mounted part emits, in order, for `et design actions` to read. */
export type HarnessEmits = { output: string; value: unknown }[];

const LINUX_CHROME: WindowChrome = {
  os: 'linux',
  left: [],
  right: ['minimize', 'maximize', 'close'],
  preferNoCsd: false,
};

type HarnessState = { part: string; component: Type<unknown>; props: Record<string, unknown> } | { error: string };

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

@Component({
  selector: 'ethlete-root',
  template: `
    @let current = state();

    @if (current && 'error' in current) {
      <p>{{ current.error }}</p>
    } @else if (current) {
      <div [class]="page ? 'block min-h-screen w-screen' : 'flow-root w-fit'" data-design-harness-host>
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
  private outlet = viewChild('outlet', { read: ViewContainerRef });
  private templatesRef: ComponentRef<{ templates: () => Record<string, unknown> }> | null = null;
  protected state = toSignal(stateOf$(this.platformLocation.search));
  protected page = new URLSearchParams(this.platformLocation.search).get('layout') === 'page';

  constructor() {
    effect(() => {
      const outlet = this.outlet();
      const state = this.state();

      if (!outlet || !state || 'error' in state) return;

      untracked(() => {
        outlet.clear();
        this.templatesRef?.destroy();
        this.templatesRef = null;

        const injector = Injector.create({
          parent: this.injector,
          providers: [
            {
              provide: OVERLAY_REF,
              useValue: { close: () => undefined, busy: signal(false) } as unknown as OverlayRef,
            },
            { provide: WINDOW_CHROME, useValue: signal(LINUX_CHROME).asReadonly() },
          ],
        });
        const ref = outlet.createComponent(state.component, { injector });

        Object.entries({ ...this.templatesOf(state.part, injector), ...state.props }).forEach(([name, value]) => {
          if (name === 'class') {
            if (typeof value === 'string')
              this.renderer.addClass(ref.location.nativeElement, ...value.split(/\s+/).filter(Boolean));

            return;
          }

          ref.setInput(name, value);
        });

        this.recordOutputs(state.component, ref.instance as Record<string, unknown>);
      });
    });
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

  private recordOutputs(component: Type<unknown>, instance: Record<string, unknown>) {
    const emits: HarnessEmits = [];

    if (this.document.defaultView) Reflect.set(this.document.defaultView, '__etDesignEmits', emits);

    for (const { propName, templateName } of reflectComponentType(component)?.outputs ?? []) {
      const output = instance[propName] as OutputRef<unknown> | undefined;

      if (output)
        outputToObservable(output)
          .pipe(tap((value) => emits.push({ output: templateName, value })))
          .subscribe();
    }
  }
}
