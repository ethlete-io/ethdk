import {
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { DesignRefusalError } from '../../host/design';
import { PartApproval, acceptEdit$, giveGo$, partApproval$ } from '../../host/design-part-approval';
import { STUDIO_LABELS } from '../i18n/studio-labels';

type Refusal = { text: string; findings: string[] };

const LABELS = STUDIO_LABELS.approval;

const refusalOf = (error: unknown): Refusal => {
  if (error instanceof DesignRefusalError && LABELS.refused[error.reason])
    return { text: LABELS.refused[error.reason] ?? '', findings: error.findings };

  return { text: LABELS.failed(error instanceof Error ? error.message : String(error)), findings: [] };
};

@Component({
  selector: 'ethlete-part-approval',
  template: `
    @if (approval(); as shown) {
      @if (shown.go) {
        <span class="self-center text-small text-text-muted" data-part-go-given>{{ LABELS.goGiven }}</span>
      } @else if (shown.hash) {
        <button
          [disabled]="busy()"
          [title]="LABELS.giveGoTitle"
          (click)="giveGo(shown.hash)"
          et-button
          type="button"
          variant="filled"
          size="sm"
          data-part-give-go
        >
          {{ LABELS.giveGo }}
        </button>
      }
      @if (shown.directEdit && shown.hash) {
        <button
          [disabled]="busy()"
          [title]="LABELS.acceptTitle"
          (click)="accept(shown.hash)"
          et-button
          type="button"
          variant="filled"
          size="sm"
          data-part-accept
        >
          {{ LABELS.accept }}
        </button>
      } @else if (accepted()) {
        <span class="self-center text-small text-text-muted" data-part-accepted>{{ LABELS.accepted }}</span>
      }
      @if (refusal(); as refused) {
        <section
          [etProvideColor]="errorTheme()"
          class="absolute top-full right-0 mt-2 flex w-xl flex-col gap-2 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-3 text-small shadow-lg"
          role="alert"
          data-part-approval-refusal
        >
          <p class="m-0 text-(--et-theme-color-primary-solid)">{{ refused.text }}</p>
          @if (refused.findings.length > 0) {
            <ul class="m-0 flex list-none flex-col gap-1 p-0 font-mono break-all text-text-muted">
              @for (finding of refused.findings; track $index) {
                <li>{{ finding }}</li>
              }
            </ul>
          }
        </section>
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
  host: { class: 'relative flex gap-2' },
})
export class PartApprovalComponent {
  private destroyRef = inject(DestroyRef);
  protected errorTheme = injectSemanticColorTheme('error');
  public port = input.required<number>();
  public product = input.required<string>();
  public part = input.required<string>();
  /** Reads the part's approval anew on each change. */
  public revision = input(0);
  /** Emits after a stored go or accept. */
  public approve = output<void>();
  protected readonly LABELS = LABELS;

  private reread = signal(0);

  protected approval = toSignal(
    toObservable(
      computed(() => ({
        address: { port: this.port(), product: this.product() },
        part: this.part(),
        revision: this.revision() + this.reread(),
      })),
    ).pipe(
      switchMap(({ address, part }) =>
        partApproval$(address, part).pipe(catchError(() => of<PartApproval | null>(null))),
      ),
    ),
    { initialValue: null },
  );

  protected accepted = linkedSignal<string, boolean>({ source: this.part, computation: () => false });

  protected refusal = linkedSignal<string, Refusal | null>({ source: this.part, computation: () => null });

  protected busy = signal(false);

  protected giveGo(hash: string) {
    this.run(giveGo$(this.address(), { part: this.part(), hash }).pipe(map(() => false)));
  }

  protected accept(hash: string) {
    this.run(acceptEdit$(this.address(), { part: this.part(), hash }).pipe(map(() => true)));
  }

  private address() {
    return { port: this.port(), product: this.product() };
  }

  private run(click$: Observable<boolean>) {
    if (this.busy()) return;

    this.busy.set(true);
    this.refusal.set(null);
    click$
      .pipe(
        tap((accepted) => {
          if (accepted) this.accepted.set(true);

          this.reread.update((count) => count + 1);
          this.approve.emit();
        }),
        catchError((error: unknown) => {
          this.refusal.set(refusalOf(error));

          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
