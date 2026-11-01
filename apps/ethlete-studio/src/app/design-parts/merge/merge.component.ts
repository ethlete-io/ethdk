import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, model, output, ViewEncapsulation } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { DISCLOSURE_BODY_CLASS, DisclosureComponent } from '../disclosure/disclosure.component';
import { ShellMainComponent, ShellSection } from '../shell-main/shell-main.component';
import { StudioMenuComponent } from '../studio-menu/studio-menu.component';
import { MERGE_SAMPLE_CHANGED, MERGE_SAMPLE_TARGET, MERGE_SAMPLE_UNCHANGED } from './merge-sample';

const SCALE = 0.37;

const CROP = { width: 266, height: 64, scale: 2 };

@Component({
  selector: 'ethlete-merge',
  template: `
    <ethlete-shell-main
      [product]="product()"
      [products]="products()"
      [project]="project()"
      [projects]="projects()"
      [panel]="panel()"
      (collapse)="collapse.emit()"
      (sectionChange)="sectionChange.emit($event)"
      (productChange)="productChange.emit($event)"
      (allProducts)="allProducts.emit()"
      (projectChange)="projectChange.emit($event)"
      (openProject)="openProject.emit()"
      fill
      section="Sketches"
    >
      <ethlete-studio-menu [(open)]="menuOpen" shellMainStudio bare />
      <div class="box-border flex h-full flex-col gap-space-2 px-space-1 pt-space-1 pb-space-2" shellMainSide>
        <div class="-mt-space-1 ml-[calc(var(--space-3)*-1_-_var(--space-1)/2)] flex">
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
        <span class="flex-1"></span>
        <div class="flex flex-col gap-space-3 border-t border-et-surface-border pt-space-3">
          <button (click)="merge.emit()" et-button type="button" variant="filled" size="sm">{{ LABELS.merge }}</button>
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
              <ng-container *ngTemplateOutlet="shot; context: { $implicit: row, src: nowSrc() }" />
            </figure>
            <figure class="m-0 flex flex-col gap-space-2">
              <figcaption class="text-ui-xs text-et-surface-muted">
                {{ LABELS.after }} <code class="font-code text-et-theme-ink">{{ target().variant }}</code>
              </figcaption>
              <ng-container *ngTemplateOutlet="shot; context: { $implicit: row, src: afterSrc() }" />
            </figure>
          </div>
          <div class="flex flex-col gap-space-2">
            <span class="text-ui-xs text-et-surface-muted">{{ LABELS.instance(row.instances) }}</span>
            <div class="flex gap-space-4">
              @for (after of [false, true]; track after) {
                <div
                  [style.width.px]="CROP.width * CROP.scale"
                  [style.height.px]="CROP.height * CROP.scale"
                  class="relative flex-none overflow-hidden rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
                >
                  <div
                    [style.width.px]="CROP.width"
                    [style.height.px]="CROP.height"
                    [style.transform]="'scale(' + CROP.scale + ')'"
                    class="pointer-events-none origin-top-left"
                  >
                    <div class="flex size-full items-center justify-center">
                      <button
                        [class.rounded-(--radius-pill)]="after"
                        class="outline-1 outline-offset-1 outline-(--et-theme-color-primary-solid)"
                        et-button
                        type="button"
                        variant="outline"
                        size="sm"
                        tabindex="-1"
                      >
                        {{ cropLabel() }}
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </ethlete-shell-main>

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
          <iframe
            [src]="src"
            [title]="row.part"
            [style.width.px]="row.width"
            [style.height.px]="row.height"
            class="block border-0"
          ></iframe>
        </div>
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, NgTemplateOutlet, ShellMainComponent, StudioMenuComponent, DisclosureComponent],
  host: { class: 'block h-screen w-full' },
})
export class MergeComponent {
  private sanitizer = inject(DomSanitizer);

  public unchanged = model(false);
  public target = input(MERGE_SAMPLE_TARGET);
  public changed = input(MERGE_SAMPLE_CHANGED);
  public selected = input(1);
  public unchangedStates = input(MERGE_SAMPLE_UNCHANGED);
  public cropLabel = input<string>(STUDIO_LABELS.start.copyPrompt);
  public product = input('studio');
  public products = input(['studio', 'timetrack', 'docs']);
  public project = input('ethlete-sdk');
  public projects = input(['ethlete-sdk', 'fut-frontend', 'design-playground']);
  public panel = input<'open' | 'hidden'>('open');
  public menuOpen = model(false);

  public pick = output<string>();
  public back = output();
  public merge = output();
  public collapse = output();
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public allProducts = output();
  public projectChange = output<string>();
  public openProject = output();

  protected readonly LABELS = STUDIO_LABELS.merge;
  protected readonly DISCLOSURE_BODY_CLASS = DISCLOSURE_BODY_CLASS;
  protected readonly SCALE = SCALE;
  protected readonly CROP = CROP;

  protected current = computed(() => this.changed()[this.selected()] ?? this.changed()[0] ?? null);

  protected nowSrc = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.current()?.now ?? ''));

  protected afterSrc = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.current()?.after ?? ''));
}
