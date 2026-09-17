import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Call, CallOption, Project, Verdict, designProject$, designSetVerdict$, frameUrl } from '../../host/design';
import { workspaceRoot$ } from '../../host/workspace';

@Component({
  selector: 'ethlete-call-view',
  template: `
    <div class="flex h-dvh min-h-0 flex-col gap-4 p-8">
      <div class="flex flex-wrap items-baseline gap-4">
        <h1 class="text-h2">Calls</h1>
        <input
          [value]="checkout()"
          (change)="setCheckout(typed($event))"
          class="grow rounded border border-et-surface-border px-3 py-1 text-mono"
          placeholder="The checkout the design work lives in"
        />
      </div>

      @if (trouble(); as message) {
        <p class="text-et-surface-muted">{{ message }}</p>
      }

      <div class="flex min-h-0 grow gap-6">
        <ul class="w-80 shrink-0 overflow-auto rounded border border-et-surface-border">
          @for (call of calls(); track call.slug) {
            <li>
              <button
                [class.bg-et-surface-bg]="call.slug === slug()"
                (click)="openCall(call)"
                class="flex w-full flex-col gap-1 border-b border-et-surface-border p-3 text-left"
                type="button"
              >
                <span class="text-et-surface-muted">{{ call.eyebrow }}</span>
                <span>{{ call.headline }}</span>
                <span class="text-et-surface-muted">{{ settled(call) }} of {{ call.options.length }} settled</span>
              </button>
            </li>
          }
        </ul>

        @if (call(); as open) {
          <div class="flex min-h-0 grow flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              @for (option of open.options; track option.key) {
                <button
                  [class.bg-et-surface-bg]="option.key === optionKey()"
                  (click)="optionKey.set(option.key)"
                  class="rounded border border-et-surface-border px-3 py-1"
                  type="button"
                >
                  {{ option.name }}
                  @if (option.verdict) {
                    <span class="text-et-surface-muted">{{ option.verdict }}</span>
                  }
                </button>
              }
            </div>

            @if (option(); as drawn) {
              <div class="flex flex-wrap items-center gap-2">
                <button
                  (click)="rule(drawn, 'chosen')"
                  class="rounded border border-et-surface-border px-3 py-1"
                  type="button"
                >
                  Accept
                </button>
                <button
                  (click)="rule(drawn, 'rejected')"
                  class="rounded border border-et-surface-border px-3 py-1"
                  type="button"
                >
                  Reject
                </button>
                <button
                  (click)="rule(drawn, null)"
                  class="rounded border border-et-surface-border px-3 py-1"
                  type="button"
                >
                  Open again
                </button>
                <span class="text-et-surface-muted text-mono">{{ address() }}</span>
              </div>

              <iframe
                [src]="source()"
                [style.width.px]="open.frameWidth"
                class="min-h-0 grow rounded border border-et-surface-border bg-et-surface-bg"
                title="The drawn option"
              ></iframe>
            }
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CallViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  protected checkout = signal('');
  protected slug = signal('');
  protected optionKey = signal('');
  protected trouble = signal('');

  private project = signal<Project | null>(null);

  protected calls = computed(() => this.project()?.calls ?? []);

  protected call = computed(() => this.calls().find((call) => call.slug === this.slug()) ?? null);

  protected option = computed(() => this.call()?.options.find((o) => o.key === this.optionKey()) ?? null);

  protected address = computed(() => {
    const port = this.project()?.port;
    const option = this.option();

    return port && option ? frameUrl({ port, slug: this.slug(), option: option.key }) : '';
  });

  protected source = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.address()));

  constructor() {
    workspaceRoot$()
      .pipe(
        catchError(() => of('')),
        tap((root) => this.setCheckout(root)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected settled(call: Call) {
    return call.options.filter((option) => option.verdict).length;
  }

  protected typed(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected setCheckout(path: string) {
    this.checkout.set(path);
    this.read();
  }

  protected openCall(call: Call) {
    this.slug.set(call.slug);
    this.optionKey.set(call.options[0]?.key ?? '');
  }

  protected rule(option: CallOption, verdict: Verdict | null) {
    designSetVerdict$({ checkout: this.checkout(), slug: this.slug(), option: option.key, verdict })
      .pipe(
        switchMap(() => designProject$(this.checkout())),
        tap((project) => this.project.set(project)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private show(project: Project) {
    this.project.set(project);

    const first = project.defaultCall ?? project.calls[0]?.slug ?? '';
    const call = project.calls.find((entry) => entry.slug === first) ?? null;

    if (call) this.openCall(call);
  }

  private read() {
    const checkout = this.checkout();

    if (!checkout) return;

    this.trouble.set('');

    designProject$(checkout)
      .pipe(
        tap((project) => this.show(project)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
