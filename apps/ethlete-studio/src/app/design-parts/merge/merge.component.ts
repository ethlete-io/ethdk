import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, TemplateRef, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { DISCLOSURE_BODY_CLASS, DisclosureComponent } from '../disclosure/disclosure.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import {
  MergeRect,
  MergeRow,
  MergeSide,
  MERGE_SAMPLE_CHANGED,
  MERGE_SAMPLE_TARGET,
  MERGE_SAMPLE_UNCHANGED,
} from './merge-sample';

const SCALE = 0.37;

const CROP = { width: 266, height: 64, scale: 2, margin: 4 };

@Component({
  selector: 'ethlete-merge',
  template: `
    <ethlete-shell-page [shell]="shell()" (action)="shellAction.emit($event)" section="Sketches">
      <div class="box-border flex h-full flex-col gap-space-2 px-space-1 pt-space-1 pb-space-2" shellMainSide>
        <div class="-mt-space-1 ml-[calc(var(--space-3)*-1-var(--space-1)/2)] flex">
          <button (click)="back.emit()" et-button type="button" variant="transparent" size="sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12.5 8h-9" />
              <path d="m8 12.5-4.5-4.5 4.5-4.5" />
            </svg>
            <span>{{ LABELS.back }}</span>
          </button>
        </div>
        <div class="flex flex-col gap-space-2 border-b border-et-surface-border pb-space-3">
          <span class="font-code text-(length:--text-sm)">{{ target().part }}</span>
          <span class="flex items-center gap-space-2 text-ui-xs text-et-surface-muted">
            <span
              class="box-border inline-flex h-control-sm items-center gap-space-1 rounded-control-md bg-et-theme/20 px-space-3 text-(length:--text-sm) whitespace-nowrap text-et-theme-ink shadow-[inset_0_0_0_1px_var(--et-theme-color-primary-solid)]"
              >{{ LABELS.picked }} <code class="font-code">{{ target().variant }}</code></span
            ><span>{{ target().note }}</span>
          </span>
        </div>
        <span class="text-ui-xs text-et-surface-muted">{{ LABELS.changed }}</span>
        <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
          @for (row of changed(); track row.part + row.state) {
            <li
              [class.bg-et-theme/20]="row === current()"
              (click)="pick.emit(row.part + ' ' + row.state)"
              (keydown.enter)="pick.emit(row.part + ' ' + row.state)"
              (keydown.space)="$event.preventDefault(); pick.emit(row.part + ' ' + row.state)"
              class="cursor-pointer rounded-control-sm px-space-2 py-space-1"
              tabindex="0"
            >
              <span class="flex min-w-0 flex-wrap items-baseline gap-space-2 gap-y-0 text-ui-sm whitespace-nowrap"
                ><span class="font-code text-et-surface">{{ row.part }}</span
                ><span class="text-et-surface-muted">{{ row.state }}</span
                ><span class="basis-full text-(length:--text-xs) text-et-surface-muted">{{
                  LABELS.instances(row.instances)
                }}</span></span
              >
            </li>
          }
        </ul>
        @if (unchangedStates().states.length > 0) {
          <ethlete-disclosure
            [(open)]="unchanged"
            [label]="LABELS.unchanged(unchangedStates().states.length, unchangedStates().part)"
            size="xs"
          >
            <ul [class]="DISCLOSURE_BODY_CLASS">
              @for (state of unchangedStates().states; track state) {
                <li>
                  <span class="font-code text-et-surface">{{ unchangedStates().part }}</span
                  ><span class="text-et-surface-muted">{{ state }}</span>
                </li>
              }
            </ul>
          </ethlete-disclosure>
        }
        <span class="flex-1"></span>
        <div class="flex flex-col gap-space-3 border-t border-et-surface-border pt-space-3">
          <button [loading]="merging()" (click)="merge.emit()" et-button type="button" variant="filled" size="sm">
            {{ LABELS.merge }}
          </button>
          @if (error(); as error) {
            <p [etProvideColor]="errorTheme()" class="m-0 text-ui-xs text-et-theme-ink" role="alert">{{ error }}</p>
          }
        </div>
      </div>
      @if (current(); as row) {
        <div
          class="box-border flex h-full flex-col gap-space-5 overflow-hidden p-space-5 ps-[calc(var(--st-shell-inset-left)+var(--space-5))]"
        >
          <header class="flex flex-col gap-space-1">
            <span class="text-ui-lg font-ui-strong">{{ LABELS.usedIn(target().name) }}</span>
            <span
              ><span class="flex min-w-0 items-baseline gap-space-2 text-ui-sm whitespace-nowrap"
                ><span class="font-code text-et-surface">{{ row.part }}</span
                ><span class="text-et-surface-muted">{{ row.state }}</span
                ><span class="text-(length:--text-xs) text-et-surface-muted before:mr-space-2 before:content-['·']">{{
                  LABELS.instances(row.instances)
                }}</span></span
              ></span
            >
          </header>
          <div class="flex gap-space-4">
            <figure class="m-0 flex flex-col gap-space-2">
              <figcaption class="text-ui-xs text-et-surface-muted">{{ LABELS.now }}</figcaption>
              @if (row.missing === 'now') {
                <div
                  [style.width.px]="row.width * SCALE"
                  [style.height.px]="row.height * SCALE"
                  class="flex flex-none items-center justify-center rounded-control-md bg-et-surface-bg text-ui-sm text-et-surface-muted shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
                >
                  {{ LABELS.addedIn(target().variant) }}
                </div>
              } @else {
                <ng-container *ngTemplateOutlet="shot; context: { $implicit: row, src: row.now }" />
              }
            </figure>
            <figure class="m-0 flex flex-col gap-space-2">
              <figcaption class="text-ui-xs text-et-surface-muted">
                {{ LABELS.after }} <code class="font-code text-et-theme-ink">{{ target().variant }}</code>
              </figcaption>
              <ng-container
                *ngTemplateOutlet="shot; context: { $implicit: row, src: row.missing === 'after' ? '' : row.after }"
              />
            </figure>
          </div>
          <div class="flex flex-col gap-space-2">
            <span class="text-ui-xs text-et-surface-muted">{{ LABELS.instance(row.instances, cropPercent()) }}</span>
            <div class="flex gap-space-4">
              @for (side of SIDES; track side) {
                <div
                  [style.width.px]="CROP.width * CROP.scale"
                  [style.height.px]="CROP.height * CROP.scale"
                  class="relative flex-none overflow-hidden rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
                  inert
                >
                  @if (cropOf(row, side); as rect) {
                    <div
                      [style.width.px]="row.width"
                      [style.height.px]="row.height"
                      [style.transform]="cropTransform(rect, cropZoom())"
                      class="pointer-events-none relative origin-top-left"
                    >
                      <ng-container
                        *ngTemplateOutlet="
                          shotTemplate();
                          context: { $implicit: row, src: side === 'now' ? row.now : row.after }
                        "
                      />
                      <div
                        [style.left.px]="rect.x"
                        [style.top.px]="rect.y"
                        [style.width.px]="rect.width"
                        [style.height.px]="rect.height"
                        class="absolute outline-1 outline-offset-1 outline-(--et-theme-color-primary-solid)"
                      ></div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </ethlete-shell-page>

    <ng-template #shot let-row let-src="src">
      <div
        [style.width.px]="row.width * SCALE"
        [style.height.px]="row.height * SCALE"
        class="relative flex-none overflow-hidden rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
      >
        <div
          [style.width.px]="row.width"
          [style.height.px]="row.height"
          [style.transform]="'scale(' + SCALE + ')'"
          class="pointer-events-none origin-top-left"
        >
          <ng-container *ngTemplateOutlet="shotTemplate(); context: { $implicit: row, src: src }" />
        </div>
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective, NgTemplateOutlet, ShellPageComponent, DisclosureComponent],
  host: { class: 'block h-screen w-full' },
})
export class MergeComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public unchanged = model(false);
  public target = input(MERGE_SAMPLE_TARGET);
  public changed = input(MERGE_SAMPLE_CHANGED);
  public selected = input(1);
  public unchangedStates = input(MERGE_SAMPLE_UNCHANGED);
  public shotTemplate = input<TemplateRef<{ $implicit: MergeRow; src: string }> | null>(null);
  public merging = input(false);
  public error = input<string | null>(null);

  public shellAction = output<ShellAction>();
  public pick = output<string>();
  public back = output();
  public merge = output();

  protected readonly LABELS = STUDIO_LABELS.merge;
  protected readonly DISCLOSURE_BODY_CLASS = DISCLOSURE_BODY_CLASS;
  protected readonly SCALE = SCALE;
  protected readonly CROP = CROP;
  protected readonly SIDES: readonly MergeSide[] = ['now', 'after'];

  protected current = computed(() => this.changed()[this.selected()] ?? this.changed()[0] ?? null);

  protected cropZoom = computed(() => {
    const row = this.current();
    const rects = row ? this.SIDES.flatMap((side) => this.cropOf(row, side) ?? []) : [];

    if (rects.length === 0) return CROP.scale;

    const width = Math.max(...rects.map((rect) => rect.width)) + 2 * CROP.margin;
    const height = Math.max(...rects.map((rect) => rect.height)) + 2 * CROP.margin;
    const fit = Math.min((CROP.width * CROP.scale) / width, (CROP.height * CROP.scale) / height);

    return Math.min(CROP.scale, Math.floor(fit * 100) / 100);
  });

  protected cropPercent = computed(() => Math.round(this.cropZoom() * 100));

  protected cropOf(row: MergeRow, side: MergeSide) {
    return row.missing === side ? null : (row.crop?.[side] ?? null);
  }

  protected cropTransform(rect: MergeRect, zoom: number) {
    const x = (CROP.width * CROP.scale) / (2 * zoom) - (rect.x + rect.width / 2);
    const y = (CROP.height * CROP.scale) / (2 * zoom) - (rect.y + rect.height / 2);

    return `scale(${zoom}) translate(${x}px, ${y}px)`;
  }
}
