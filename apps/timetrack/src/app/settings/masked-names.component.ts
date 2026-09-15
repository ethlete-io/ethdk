import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { TimetrackFavoriteProject } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';

const WHY = `Every name on this list becomes a pseudonym in anything sent to the model, and the answer
comes back in your own words. Nothing about the map is stored: the same list rebuilds the same
assignment, so the list is what reads an answer back.

It is grown by hand because only you know which word in your own commit subjects is a client. The
prompt preview marks every capitalised word this list does not hold, so a name that is missing shows up
before the first send and not after it.

A project key belongs here too, and not only the project's full name. The key is what masks an issue
key: with FIFAGG on the list, FIFAGG-12623 goes out as ALDER-12623.`;

/**
 * The names the anonymiser replaces before anything leaves this machine.
 *
 * The seed offers the picked projects' keys and names, because a client name is almost always exactly a
 * project name. It is an offer and not a default: a list written without the user reading it is a list
 * nobody checks, and the one name it is missing is the one that leaks.
 */
@Component({
  selector: 'ethlete-masked-names',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Names that never leave this machine</h3>
        <ethlete-explain [text]="WHY" label="the name list" />
      </div>

      <div class="flex flex-wrap gap-2">
        @for (name of names(); track name) {
          <span
            [attr.data-masked-name]="name"
            class="flex items-center gap-1 rounded-md border border-et-surface-border py-1 pr-1 pl-3"
          >
            <span class="text-small">{{ name }}</span>

            <button
              [attr.aria-label]="'Stop masking ' + name"
              (click)="remove.emit(name)"
              et-button
              variant="transparent"
              size="sm"
            >
              Remove
            </button>
          </span>
        } @empty {
          <p class="text-small text-et-surface-subtle">
            No name is masked yet, so every word goes to the model as written.
          </p>
        }
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-input [(value)]="typed" aria-label="A name to mask" placeholder="A client, a product, a project key" />
        </et-form-field>

        <button [disabled]="!typed().trim()" (click)="addTyped()" et-button variant="outline" size="sm">Add</button>
      </div>

      @if (offered().length) {
        <div class="flex flex-col gap-2">
          <span class="text-small text-et-surface-muted">From the projects you picked</span>

          <div class="flex flex-wrap gap-2">
            @for (name of offered(); track name) {
              <button [attr.data-offered-name]="name" (click)="add.emit(name)" et-button variant="outline" size="sm">
                Add {{ name }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ExplainComponent, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class MaskedNamesComponent {
  public names = input.required<readonly string[]>();
  public projects = input.required<readonly TimetrackFavoriteProject[]>();

  public add = output<string>();
  public remove = output<string>();

  protected readonly WHY = WHY;

  protected typed = signal('');

  /** Each picked project's key and its name, minus whatever the list already holds in any case. */
  protected offered = computed(() => {
    const held = new Set(this.names().map((name) => name.trim().toLowerCase()));
    const found = new Map<string, string>();

    for (const project of this.projects()) {
      for (const word of [project.key, project.name]) {
        const key = word.trim().toLowerCase();

        if (key && !held.has(key) && !found.has(key)) found.set(key, word.trim());
      }
    }

    return [...found.values()];
  });

  protected addTyped() {
    this.add.emit(this.typed().trim());
    this.typed.set('');
  }
}
