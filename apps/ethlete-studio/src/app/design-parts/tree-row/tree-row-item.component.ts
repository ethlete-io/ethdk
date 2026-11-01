import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { injectSemanticColorTheme, ProvideColorDirective, SurfaceInteractiveDirective } from '@ethlete/core';

export type TreeRowStatus = 'in-progress' | 'ready';

export type TreeRow = {
  label: string;
  depth: number;
  kind: 'group' | 'part' | 'leaf';
  expanded?: boolean;
  selected?: boolean;
  inert?: boolean;
  warning?: string;
  status?: TreeRowStatus;
  comments?: number;
};

const STATUS_TITLE: Record<TreeRowStatus, string> = { 'in-progress': 'Sketch in progress', ready: 'Sketch ready' };

const STATUS_CLASS: Record<TreeRowStatus, string> = { 'in-progress': 'text-et-surface-muted', ready: 'text-et-theme' };

const ROW_CLASS =
  'relative flex h-5 items-center font-ui gap-space-1 rounded-control-sm pr-space-2 pl-[calc(var(--space-1)+var(--depth,0)*1.6rem)] text-[1.1rem]/[1.4rem] whitespace-nowrap outline-none cursor-default [transition:var(--transition-state)] hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15 focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus-ring)]';

const SELECTED_CLASS =
  'bg-et-theme/20 text-et-theme-ink hover:[background:linear-gradient(rgb(var(--et-theme-color-primary-rgb)/0.2),rgb(var(--et-theme-color-primary-rgb)/0.2)),color-mix(in_srgb,var(--et-surface-interaction-solid)_9%,transparent)] active:[background:linear-gradient(rgb(var(--et-theme-color-primary-rgb)/0.2),rgb(var(--et-theme-color-primary-rgb)/0.2)),color-mix(in_srgb,var(--et-surface-interaction-solid)_15%,transparent)]';

/** One row of the Studio tree: a lead chevron or dot, the label, and the end marks. Put it on the row element. */
@Component({
  selector: '[ethlete-tree-row-item]',
  template: `
    @let row = item();
    <span [class]="'flex size-4 flex-none items-center justify-center ' + accentClass()">
      @if (row.kind === 'leaf') {
        <span
          [class]="'box-border size-1.5 rounded-full ' + (row.inert ? 'border-[1.5px] border-current' : 'bg-current')"
        ></span>
      } @else {
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path [attr.d]="row.expanded ? 'm4.5 6.5 3.5 3.5 3.5-3.5' : 'm6.5 4.5 3.5 3.5-3.5 3.5'" />
        </svg>
      }
    </span>
    <span class="min-w-0 flex-1 overflow-hidden text-ellipsis">{{ row.label }}</span>
    @if (row.warning) {
      <span [etProvideColor]="warningTheme()" [title]="row.warning" class="flex flex-none text-et-theme">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2.5 14 13H2z" />
          <path d="M8 6.5v3" />
          <path d="M8 11.25v.01" />
        </svg>
      </span>
    }
    @if (row.status) {
      <span [class]="'flex flex-none ' + STATUS_CLASS[row.status]" [title]="STATUS_TITLE[row.status]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          @if (row.status === 'ready') {
            <path d="m3.5 8.5 3 3 6-7" />
          } @else {
            <path d="M10.5 3 13 5.5 6 12.5H3.5V10z" />
            <path d="m9 4.5 2.5 2.5" />
          }
        </svg>
      </span>
    }
    @if (row.comments) {
      <span
        [class]="'flex flex-none items-center gap-0.5 text-(length:--text-xs) ' + accentClass()"
        [title]="row.comments + ' open comments'"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 4.5h10v6H7.5L5 12.5v-2H3z" />
        </svg>
      </span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  hostDirectives: [SurfaceInteractiveDirective],
  host: {
    '[class]': 'hostClass()',
    '[style.--depth]': 'item().depth',
    '[attr.data-kind]': 'item().kind',
    '[attr.data-selected]': 'item().selected ? "" : null',
    '[attr.aria-current]': 'item().selected ? "true" : null',
  },
})
export class TreeRowItemComponent {
  protected warningTheme = injectSemanticColorTheme('warning');

  public item = input.required<TreeRow>();

  protected readonly STATUS_TITLE = STATUS_TITLE;
  protected readonly STATUS_CLASS = STATUS_CLASS;

  protected accentClass = computed(() => (this.item().selected ? 'text-et-theme-ink' : 'text-et-surface-muted'));

  protected hostClass = computed(() => {
    const { selected, kind } = this.item();

    if (selected) return `${ROW_CLASS} ${SELECTED_CLASS}`;

    return `${ROW_CLASS} ${kind === 'group' ? 'text-et-surface-muted' : 'text-et-surface'}`;
  });
}
