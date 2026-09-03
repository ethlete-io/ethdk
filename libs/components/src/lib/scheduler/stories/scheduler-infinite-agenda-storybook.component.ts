import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalElementIntersection } from '@ethlete/core';
import { startOfToday } from 'date-fns';
import { tap, timer } from 'rxjs';
import { SCHEDULER_IMPORTS } from '../scheduler.imports';
import { provideSchedulerEditSurface } from '../scheduler-edit-surface.provider';
import { PAGE_DAYS, TOTAL_DAYS, generateAgendaAppointments } from './scheduler-infinite-agenda-data';

const PAGE_LATENCY = 400;

@Component({
  selector: 'et-sb-scheduler-infinite-agenda',
  template: `
    <div class="p-8 font-sans">
      <et-scheduler
        [(selectedAppointmentId)]="selectedAppointmentId"
        [(focusedDate)]="focusedDate"
        [appointments]="appointments()"
        [agendaDays]="loadedDays()"
        [etSchedulerSwipeNavigation]="{ enabled: false }"
        view="agenda"
      />

      <p #listEnd class="mt-4 text-small opacity-60">
        @if (loading()) {
          Loading the next three weeks…
        } @else if (isComplete()) {
          That's everything - {{ loadedDays() }} days loaded.
        } @else {
          {{ loadedDays() }} days loaded. Keep scrolling.
        }
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...SCHEDULER_IMPORTS],
  providers: [provideSchedulerEditSurface()],
})
export class SchedulerInfiniteAgendaStorybookComponent {
  private destroyRef = inject(DestroyRef);

  private listEnd = viewChild<ElementRef<HTMLElement>>('listEnd');

  protected focusedDate = signal(startOfToday());

  /** Stepping the period is a new window, so the pages loaded into the old one are gone with it. */
  protected loadedDays = linkedSignal({ source: this.focusedDate, computation: () => PAGE_DAYS });

  protected loading = signal(false);
  protected selectedAppointmentId = signal<string | null>(null);

  protected isComplete = computed(() => this.loadedDays() >= TOTAL_DAYS);

  protected appointments = computed(() => generateAgendaAppointments(this.focusedDate(), this.loadedDays()));
  private listEndIntersection = signalElementIntersection(this.listEnd);

  constructor() {
    effect(() => {
      const reachedEnd = this.listEndIntersection().some((entry) => entry.isVisible);

      if (!reachedEnd || untracked(this.loading) || untracked(this.isComplete)) return;

      untracked(() => this.loadNextPage());
    });
  }

  private loadNextPage() {
    this.loading.set(true);

    timer(PAGE_LATENCY)
      .pipe(
        tap(() => {
          this.loadedDays.update((days) => Math.min(TOTAL_DAYS, days + PAGE_DAYS));
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
