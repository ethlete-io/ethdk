import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ExplainComponent } from './explain.component';

const WHY = `A paired machine's work lands on the checkout here that has the same origin URL. Two clones with
different remotes, or a checkout with no remote at all, match nothing, so their work stays under the other
machine's path.

An alias is the key both checkouts are matched by instead. Give each machine's checkout the same alias, on
each machine.`;

export type RepoAlias = { path: string; key: string };

/** The checkouts the user gave a key of their own, so a paired machine's clone of it lands on them. */
@Component({
  selector: 'ethlete-repo-aliases',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Same repository on a paired machine</h3>
        <ethlete-explain [text]="WHY" label="repository aliases" />
      </div>

      @if (rows().length) {
        <ul class="flex flex-col">
          @for (row of rows(); track row.path) {
            <li
              [attr.data-alias-path]="row.path"
              class="group grid grid-cols-[minmax(0,1fr)_16rem_7rem] items-center gap-x-3 rounded-md px-2 text-small hover:bg-et-surface-interaction"
            >
              <span [title]="row.path" class="truncate text-mono">{{ row.path }}</span>
              <span class="truncate text-mono" data-alias-key>{{ row.key }}</span>
              <button
                [attr.aria-label]="'Remove the alias of ' + row.path"
                (click)="setAlias.emit({ path: row.path, key: '' })"
                class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                et-button
                variant="transparent"
                size="sm"
              >
                Remove
              </button>
            </li>
          }
        </ul>
      }

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-label>Checkout</et-label>
          <et-input [(value)]="path" [placeholder]="pathHint()" />
        </et-form-field>

        <et-form-field class="w-64" appearance="underline" size="sm">
          <et-label>Alias</et-label>
          <et-input [(value)]="key" placeholder="ethlete-sdk" />
        </et-form-field>

        <button [disabled]="!canSet()" (click)="set()" et-button variant="outline" size="sm">Set alias</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ExplainComponent, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class RepoAliasesComponent {
  public repoPaths = input.required<readonly string[]>();
  public aliases = input.required<Readonly<Record<string, string>>>();

  public setAlias = output<RepoAlias>();

  protected readonly WHY = WHY;

  protected path = signal('');
  protected key = signal('');

  protected rows = computed(() =>
    Object.entries(this.aliases())
      .map(([path, key]) => ({ path, key }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );

  protected pathHint = computed(() => this.repoPaths()[0] ?? '/home/you/dev/ethlete-sdk');

  protected canSet = computed(() => !!this.path().trim() && !!this.key().trim());

  protected set() {
    this.setAlias.emit({ path: this.path().trim(), key: this.key().trim() });
    this.path.set('');
    this.key.set('');
  }
}
