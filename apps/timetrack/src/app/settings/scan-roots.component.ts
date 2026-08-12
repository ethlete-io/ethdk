import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';

/**
 * The directories the repository discovery walks.
 *
 * Naming one is not only a filter — the walk has a depth limit, so `~/dev` reaches work that starting
 * from the home directory is too shallow to find.
 */
@Component({
  selector: 'ethlete-scan-roots',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-h4">Where repositories are looked for</h3>
        <p class="text-small text-et-surface-muted">
          {{ found() }} repositories are being watched. Naming a directory also reaches deeper than the home directory
          alone.
        </p>
      </div>

      @for (root of roots(); track root) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="grow break-all text-mono text-small">{{ root }}</span>

          <button
            [attr.aria-label]="'Stop looking under ' + root"
            (click)="remove.emit(root)"
            et-button
            variant="transparent"
            size="sm"
          >
            Remove
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">The home directory is walked, three levels deep.</p>
      }

      <div class="flex flex-wrap items-center gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-input
            [(value)]="typed"
            aria-label="A directory to look for repositories under"
            placeholder="/home/you/dev"
          />
        </et-form-field>

        <button [disabled]="!typed().trim()" (click)="addRoot()" et-button variant="outline" size="sm">Add</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class ScanRootsComponent {
  public roots = input.required<readonly string[]>();
  /** How many repositories the last discovery found, so a root that matches nothing is visible. */
  public found = input(0);

  public add = output<string>();
  public remove = output<string>();

  protected typed = signal('');

  protected addRoot() {
    this.add.emit(this.typed().trim());
    this.typed.set('');
  }
}
