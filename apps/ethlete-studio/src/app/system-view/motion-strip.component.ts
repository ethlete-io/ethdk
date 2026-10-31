import { Component, ViewEncapsulation, computed, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { Observable, catchError, combineLatest, filter, map, of, pairwise, startWith, switchMap, tap } from 'rxjs';
import { ListedMotion, MotionAddress, MotionAnswer, MotionMode, motionAnswer$ } from '../../host/design-motion';
import { MotionCanvas, motionFrameIdOf } from './motion-drive';
import { MotionTimelineComponent } from './motion-timeline.component';

type MotionRow = { name: string; listed: ListedMotion; answer: MotionAnswer | null; error: string | null };

type Opened = { motion: string; ms: number };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const rowOf$ = ({
  name,
  listed,
  address,
}: {
  name: string;
  listed: ListedMotion;
  address: MotionAddress;
}): Observable<MotionRow> =>
  motionAnswer$(address).pipe(
    map((answer): MotionRow => ({ name, listed, answer, error: null })),
    catchError((error: unknown) => of<MotionRow>({ name, listed, answer: null, error: messageOf(error) })),
    startWith<MotionRow>({ name, listed, answer: null, error: null }),
  );

@Component({
  selector: 'ethlete-motion-strip',
  template: `
    <section
      class="flex flex-col gap-3 border-t border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-3"
      data-motions
    >
      <header class="flex flex-wrap items-center gap-2">
        <span class="text-small font-semibold text-text">Motions</span>
        <span class="flex-1"></span>
        @for (name of presets(); track name) {
          <button
            [pressed]="preset() === name"
            (click)="preset.set(name)"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="sm"
            data-motion-preset
          >
            {{ name }}
          </button>
        }
        <button
          [pressed]="mode() === 'reduced'"
          (click)="mode.set(mode() === 'reduced' ? 'full' : 'reduced')"
          et-button
          type="button"
          variant="outline"
          color="surface"
          size="sm"
          title="Draw the motions with reduced motion"
          data-motion-reduced
        >
          Reduced
        </button>
      </header>
      @for (row of rows(); track row.name) {
        <div [attr.data-motion]="row.name" class="flex items-start gap-3">
          <span class="flex w-40 shrink-0 flex-col text-small">
            <span class="truncate font-mono text-text">{{ row.name }}</span>
            <span class="truncate text-text-muted">{{ row.listed.from }} → {{ row.listed.to }}</span>
          </span>
          @if (row.error) {
            <p
              [etProvideColor]="errorTheme()"
              class="m-0 text-small text-(--et-theme-color-primary-solid)"
              data-motion-error
            >
              {{ row.error }}
            </p>
          } @else if (row.answer; as answer) {
            <div class="flex min-w-0 gap-2 overflow-x-auto">
              @for (keyframe of answer.keyframes; track keyframe.ms) {
                <button
                  [pressed]="opened()?.motion === row.name && opened()?.ms === keyframe.ms"
                  (click)="open({ motion: row.name, ms: keyframe.ms }, row.listed)"
                  class="h-auto shrink-0 flex-col py-1"
                  et-button
                  type="button"
                  variant="outline"
                  color="surface"
                  size="sm"
                  data-motion-keyframe
                >
                  <img [src]="keyframe.src" [alt]="row.name + ' at ' + keyframe.ms + ' ms'" class="h-20 w-auto" />
                  <span class="font-mono">{{ keyframe.ms }} ms</span>
                </button>
              }
            </div>
          } @else {
            <span class="text-small text-text-muted" data-motion-loading>Drawing…</span>
          }
        </div>
      }
      @if (openedAnswer(); as shown) {
        <ethlete-motion-timeline
          [answer]="shown.answer"
          [start]="shown.ms"
          [frame]="drivenWindow()"
          (dismiss)="opened.set(null)"
        />
      }
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective, MotionTimelineComponent],
})
export class MotionStripComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public port = input.required<number>();
  public product = input.required<string>();
  public part = input.required<string>();
  public motions = input.required<Record<string, ListedMotion>>();
  public presets = input<string[]>([]);
  public surface = input<string>();
  public color = input<string>();
  /** Draws the motions anew on each change. */
  public revision = input(0);
  /** The canvas whose frame an open timeline makes live and drives. */
  public canvas = input<MotionCanvas | null>(null);

  protected preset = linkedSignal(() => this.presets()[0] ?? null);
  protected mode = signal<MotionMode>('full');
  protected opened = linkedSignal<string, Opened | null>({ source: this.part, computation: () => null });

  private addresses = computed(() =>
    Object.entries(this.motions()).map(([name, listed]) => ({
      name,
      listed,
      address: {
        port: this.port(),
        product: this.product(),
        part: this.part(),
        motion: name,
        preset: this.preset(),
        mode: this.mode(),
        surface: this.surface(),
        color: this.color(),
        revision: this.revision(),
      } satisfies MotionAddress,
    })),
  );

  protected rows = toSignal(
    toObservable(this.addresses).pipe(
      switchMap((addresses) => (addresses.length === 0 ? of([]) : combineLatest(addresses.map(rowOf$)))),
    ),
    { initialValue: [] },
  );

  protected openedAnswer = computed(() => {
    const opened = this.opened();
    const answer = opened && this.rows().find((row) => row.name === opened.motion)?.answer;

    return opened && answer ? { answer, ms: opened.ms } : null;
  });

  private drivenId = computed(() => {
    const opened = this.opened();
    const from = opened && this.motions()[opened.motion]?.from;
    const canvas = this.canvas();

    return from && canvas ? motionFrameIdOf(canvas.frames(), { state: from, preset: this.preset() }) : null;
  });

  protected drivenWindow = computed(() => {
    const id = this.drivenId();

    return id ? (this.canvas()?.liveWindowOf(id) ?? null) : null;
  });

  private target = computed(() => {
    const id = this.drivenId();

    return id === null ? null : `${id}\n${this.mode()}`;
  });

  constructor() {
    toObservable(this.target)
      .pipe(
        pairwise(),
        filter(([previous, next]) => previous !== null && next !== null),
        tap(() => this.follow(this.drivenId())),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected open(opened: Opened, listed: ListedMotion) {
    this.opened.set(opened);

    const canvas = this.canvas();

    this.follow(canvas && motionFrameIdOf(canvas.frames(), { state: listed.from, preset: this.preset() }));
  }

  private follow(id: string | null) {
    const canvas = this.canvas();

    if (!canvas || !id) return;

    canvas.activate(id);
    canvas.focusFrame(id);
  }
}
