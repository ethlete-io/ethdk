import { Component, input, ViewEncapsulation } from '@angular/core';
import { applicationConfig, moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { BlockTone, TimelineBlockComponent } from './timeline-block.component';

type Case = {
  name: string;
  asks: string;
  tone: BlockTone;
  label: string;
  detail?: string;
  marked?: boolean;
  standIn?: boolean;
  excluded?: boolean;
  dragging?: boolean;
};

const CASES: Case[] = [
  {
    name: 'certain',
    asks: 'nothing',
    tone: 'success',
    label: 'ET-772 · 45m',
    detail: 'feat(repo): Answer the parent with the epic',
  },
  {
    name: 'likely',
    asks: 'a glance',
    tone: 'brand',
    label: 'ET-772 · 45m',
    detail: 'fix(agent-rules): Fire the warning',
  },
  {
    name: 'weak',
    asks: 'a yes or a no',
    tone: 'warning',
    label: 'Not yet named · 45m',
    detail: 'feat(platform): Auto size the player item name',
  },
  {
    name: 'stand-in',
    asks: 'a ticket, later',
    tone: 'pending',
    label: 'Toty public fixes · 45m',
    detail: 'fix(toty-public): Correct the showcase layout',
    standIn: true,
  },
  { name: 'excluded', asks: 'nothing', tone: 'neutral', label: 'Not counted · 45m', detail: 'Open Room #1 · Discord' },
  {
    name: 'marked',
    asks: 'a merge',
    tone: 'success',
    label: 'ET-772 · 45m',
    detail: 'Marked for a merge',
    marked: true,
  },
  {
    name: 'dragging',
    asks: 'a drop',
    tone: 'brand',
    label: 'ET-772 · 45m',
    detail: 'Moves under the pointer',
    dragging: true,
  },
];

const BAND_BASE =
  'flex w-full flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border px-2 py-1 text-small text-et-surface-muted';

@Component({
  selector: 'ethlete-design-band-gallery',
  template: `
    <div class="flex flex-col gap-10 p-10">
      <div class="flex flex-col gap-2">
        <h2 class="text-h3">The band, as it is today</h2>
        <p class="max-w-3xl text-small text-et-surface-muted">
          Every colour a band can take, and the two textures that share its lane. Read down the
          <em>asks</em> column: a band that asks nothing should be quieter than one that asks for an answer.
        </p>
      </div>

      <div class="flex flex-wrap gap-4">
        @for (c of cases(); track c.name) {
          <div class="flex w-64 flex-col gap-2">
            <div class="flex items-baseline justify-between text-mono">
              <span class="text-et-surface-ink">{{ c.name }}</span>
              <span class="text-et-surface-subtle">asks {{ c.asks }}</span>
            </div>
            <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
              <ethlete-design-band
                [detail]="c.detail ?? ''"
                [dragging]="!!c.dragging"
                [excluded]="!!c.excluded"
                [label]="c.label"
                [marked]="!!c.marked"
                [minutes]="minutes()"
                [standIn]="!!c.standIn"
                [tone]="c.tone"
              />
            </div>
          </div>
        }

        <div class="flex w-64 flex-col gap-2">
          <div class="flex items-baseline justify-between text-mono">
            <span class="text-et-surface-ink">in the background</span>
            <span class="text-et-surface-subtle">asks nothing</span>
          </div>
          <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
            <div
              [style.height.rem]="heightRem()"
              class="bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,var(--color-et-surface-border)_6px,var(--color-et-surface-border)_7px)] {{
                BAND_BASE
              }}"
            >
              <span class="block truncate">ET-772 · in the background · 45m</span>
            </div>
          </div>
        </div>

        <div class="flex w-64 flex-col gap-2">
          <div class="flex items-baseline justify-between text-mono">
            <span class="text-et-surface-ink">break</span>
            <span class="text-et-surface-subtle">asks a click</span>
          </div>
          <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
            <div [style.height.rem]="heightRem()" class="bg-et-surface-interaction {{ BAND_BASE }}">
              <span class="block truncate">45m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TimelineBlockComponent],
})
class BlockGalleryComponent {
  public minutes = input(45);
  public cases = input<Case[]>(CASES);

  protected readonly BAND_BASE = BAND_BASE;

  protected heightRem() {
    return (this.minutes() / 60) * 8;
  }
}

@Component({
  selector: 'ethlete-design-band-ladder',
  template: `
    <div class="flex flex-col gap-10 p-10">
      <div class="flex flex-col gap-2">
        <h2 class="text-h3">The same band, at every length</h2>
        <p class="max-w-3xl text-small text-et-surface-muted">
          A band drops its detail line under 5rem and its padding under 2.2rem. Fifteen minutes is the shortest a rule
          will draw.
        </p>
      </div>
      <div class="flex items-start gap-4">
        @for (m of MINUTES; track m) {
          <div class="flex w-56 flex-col gap-2">
            <span class="text-mono text-et-surface-subtle">{{ m }}m</span>
            <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">
              <ethlete-design-band
                [minutes]="m"
                detail="feat(repo): Answer the parent with the epic"
                label="ET-772"
                tone="success"
              />
            </div>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TimelineBlockComponent],
})
class DurationLadderComponent {
  protected readonly MINUTES = [15, 30, 45, 60, 120, 180];
}

const meta: Meta<BlockGalleryComponent> = {
  title: 'Timeline/Band',
  component: BlockGalleryComponent,
  decorators: [
    applicationConfig({ providers: [] }),
    moduleMetadata({ imports: [BlockGalleryComponent, DurationLadderComponent] }),
  ],
};

export default meta;

export const States: StoryObj<BlockGalleryComponent> = {
  args: { minutes: 45 },
};

export const Durations: StoryObj = {
  render: () => ({ template: '<ethlete-design-band-ladder />' }),
};
