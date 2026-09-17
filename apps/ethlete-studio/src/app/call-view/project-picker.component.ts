import { Component, ViewEncapsulation, input, output } from '@angular/core';
import { ProjectSummary } from './grouping';

@Component({
  selector: 'ethlete-project-picker',
  template: `
    <div class="flex min-h-0 grow flex-col gap-4">
      <h2 class="text-h3">Pick a project</h2>

      <ul class="grid grid-cols-3 gap-4 overflow-auto">
        @for (project of projects(); track project.name) {
          <li>
            <button
              (click)="pick.emit(project.name)"
              class="flex w-full flex-col gap-2 rounded border border-et-surface-border p-4 text-left"
              type="button"
            >
              <span class="text-h4">{{ project.name }}</span>
              <span class="text-et-surface-muted">
                {{ project.calls }} {{ project.calls === 1 ? 'call' : 'calls' }}
                @if (project.open) {
                  · {{ project.open }} open
                }
              </span>
            </button>
          </li>
        } @empty {
          <li class="text-et-surface-muted">This checkout holds no call.</li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class ProjectPickerComponent {
  public projects = input.required<ProjectSummary[]>();
  public pick = output<string>();
}
