import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, catchError, finalize, tap } from 'rxjs';
import { ListedProduct, designAnswer$ } from '../../host/design';

const NO_BASE = '';

@Component({
  selector: 'ethlete-new-product-form',
  template: `
    <form (submit)="submit($event)" class="my-3 flex flex-col gap-3">
      <et-form-field appearance="box">
        <et-label>Name</et-label>
        <et-input [(value)]="name" class="font-mono" placeholder="web" />
      </et-form-field>
      @if (bases().length > 0) {
        <et-form-field appearance="box">
          <et-label>Base</et-label>
          <et-select [(value)]="base">
            <et-select-option [value]="NO_BASE" label="No base">No base</et-select-option>
            @for (listed of bases(); track listed.name) {
              <et-select-option [value]="listed.name" [label]="listed.name">{{ listed.name }}</et-select-option>
            }
          </et-select>
        </et-form-field>
      }
      @if (error(); as message) {
        <p [etProvideColor]="errorTheme()" class="m-0 text-small text-[var(--et-theme-color-primary-solid)]">
          {{ message }}
        </p>
      }
      <div class="flex justify-end">
        <button [disabled]="busy() || name().trim() === ''" et-button type="submit" variant="filled" size="sm">
          Create product
        </button>
      </div>
    </form>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SELECT_IMPORTS, ProvideColorDirective],
})
export class NewProductFormComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  public port = input.required<number>();
  public products = input<ListedProduct[]>([]);
  public create = output<string>();
  protected readonly NO_BASE = NO_BASE;

  protected name = signal('');

  protected base = signal(NO_BASE);

  protected busy = signal(false);

  protected error = signal('');

  protected bases = computed(() => this.products().filter((listed) => !listed.base));

  protected submit(event: Event) {
    event.preventDefault();

    const name = this.name().trim();

    if (!name || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    newProduct$({ port: this.port(), name, base: this.base() || null })
      .pipe(
        tap((answer) => this.create.emit(answer.name)),
        catchError((error: unknown) => {
          this.error.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

export const newProduct$ = (options: { port: number; name: string; base: string | null }) =>
  designAnswer$<{ name: string }>(`http://localhost:${options.port}/__design/product`, {
    method: 'POST',
    body: JSON.stringify({ name: options.name, base: options.base }),
  });
