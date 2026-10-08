import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import {
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  NUMBER_INPUT_IMPORTS,
  SELECT_IMPORTS,
} from '@ethlete/components';
import { BUILT_IN_PRICES, CLAUDE_CODE_PROVIDER, CODEX_PROVIDER, ModelPrice, PriceTable } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';
import {
  MODEL_PRICE_PRESETS,
  MODEL_PRICE_PRESETS_CHECKED,
  ModelPricePreset,
  presetByKey,
  presetKey,
} from './model-price-presets';
import { CURRENCIES, withStoredOption } from './select-options';

const WHY = `A day's spend becomes a cost through these prices. Each turn is priced at the latest price
for its model dated on or before the turn: yours first, then the built-in list. A new price never
reprices the days before its date.

The built-in list is USD and ships with each release, so a known model needs no setup. Your table holds
overrides and models the list does not know. In another currency only your own prices apply, with no
conversion. A model with no price shows its spend and no cost, and is named.

Rates are per million tokens. Thinking is priced as output.`;

const PROVIDERS = [CLAUDE_CODE_PROVIDER, CODEX_PROVIDER];

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayStartOf = (typed: string) => {
  const match = DAY_PATTERN.exec(typed.trim());

  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const at = new Date(year ?? 0, (month ?? 1) - 1, day);

  return at.getMonth() === (month ?? 1) - 1 ? at : null;
};

const calendarDayOf = (at: Date) =>
  [at.getFullYear(), at.getMonth() + 1, at.getDate()].map((part) => String(part).padStart(2, '0')).join('-');

const rateOf = (value: number | null) => (value !== null && Number.isFinite(value) && value >= 0 ? value : null);

@Component({
  selector: 'ethlete-price-table',
  template: `
    <div class="flex flex-col gap-3" data-price-table>
      <div class="flex items-center gap-1">
        <h3 class="text-h4">What a model costs</h3>
        <ethlete-explain [text]="WHY" label="model prices" />
      </div>

      <details class="flex flex-col gap-2" data-built-in-prices>
        <summary class="cursor-pointer text-small text-et-surface-muted">
          Built-in prices, USD per million tokens, checked {{ PRESETS_CHECKED }}
        </summary>
        @for (group of BUILT_IN_GROUPS; track group.provider) {
          <div class="mt-2 flex flex-col gap-1">
            <span class="text-small">{{ group.provider }}</span>
            @for (price of group.prices; track price.model) {
              <div
                [attr.data-built-in-price]="price.model"
                class="flex flex-wrap gap-x-3 text-small text-et-surface-muted"
              >
                <span class="text-mono min-w-44">{{ price.model }}</span>
                <span>
                  in {{ price.input }} · out {{ price.output }} · cache write {{ price.cacheWrite }} · cache read
                  {{ price.cacheRead }}
                </span>
              </div>
            }
          </div>
        }
      </details>

      <h4 class="text-base">Your prices</h4>
      <p class="text-small text-et-surface-subtle">Overrides of the list above, and models it does not know.</p>

      <et-form-field class="w-56" appearance="underline" size="sm">
        <et-label>Currency</et-label>
        <et-select [value]="table().currency" (valueChange)="setCurrency($event)" data-price-currency>
          @for (option of currencies(); track option.value) {
            <et-select-option [value]="option.value" [label]="option.label" />
          }
        </et-select>
      </et-form-field>

      @for (price of sorted(); track price.provider + price.model + price.from.getTime()) {
        <div
          [attr.data-model-price]="price.model"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-et-surface-border p-3"
        >
          <span class="text-mono text-small">{{ price.provider }} · {{ price.model }}</span>
          <span class="text-small text-et-surface-muted">from {{ DAY_OF(price) }}</span>
          <span class="grow text-small text-et-surface-muted">
            in {{ price.input }} · out {{ price.output }} · cache write {{ price.cacheWrite }} · cache read
            {{ price.cacheRead }} per million
          </span>

          <button
            [attr.aria-label]="'Remove the price of ' + price.model + ' from ' + DAY_OF(price)"
            (click)="remove.emit(price)"
            et-button
            variant="transparent"
            size="sm"
          >
            Remove
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">You have none, so the built-in prices apply.</p>
      }

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="min-w-50 max-w-96 grow" appearance="underline" size="sm">
          <et-label>Preset</et-label>
          <et-select
            [(value)]="presetKey"
            (valueChange)="applyPreset($event)"
            placeholder="Start an override from a known model"
            data-price-preset
          >
            @for (group of PRESET_GROUPS; track group.provider) {
              <et-select-option-group [label]="group.provider">
                @for (preset of group.presets; track preset.key) {
                  <et-select-option [value]="preset.key" [label]="preset.model" />
                }
              </et-select-option-group>
            }
          </et-select>
        </et-form-field>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="w-36" appearance="underline" size="sm">
          <et-label>Agent</et-label>
          <et-select [(value)]="provider">
            @for (option of PROVIDERS; track option) {
              <et-select-option [value]="option" [label]="option" />
            }
          </et-select>
        </et-form-field>

        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-label>Model</et-label>
          <et-input [(value)]="model" placeholder="as the log names it" data-price-model />
        </et-form-field>

        <et-form-field class="w-32" appearance="underline" size="sm">
          <et-label>From</et-label>
          <et-input [(value)]="from" placeholder="yyyy-mm-dd" data-price-from />
        </et-form-field>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="w-28" appearance="underline" size="sm">
          <et-label>Input</et-label>
          <et-number-input [(value)]="inputRate" [min]="0" data-price-input />
        </et-form-field>

        <et-form-field class="w-28" appearance="underline" size="sm">
          <et-label>Output</et-label>
          <et-number-input [(value)]="outputRate" [min]="0" data-price-output />
        </et-form-field>

        <et-form-field class="w-28" appearance="underline" size="sm">
          <et-label>Cache write</et-label>
          <et-number-input [(value)]="cacheWriteRate" [min]="0" data-price-cache-write />
        </et-form-field>

        <et-form-field class="w-28" appearance="underline" size="sm">
          <et-label>Cache read</et-label>
          <et-number-input [(value)]="cacheReadRate" [min]="0" data-price-cache-read />
        </et-form-field>

        <button [disabled]="!typed()" (click)="addTyped()" et-button variant="outline" size="sm" data-price-add>
          Add
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ExplainComponent, FORM_FIELD_IMPORTS, INPUT_IMPORTS, NUMBER_INPUT_IMPORTS, SELECT_IMPORTS],
})
export class PriceTableComponent {
  public table = input.required<PriceTable>();

  public currencyChange = output<string>();
  public add = output<ModelPrice>();
  public remove = output<ModelPrice>();

  protected readonly WHY = WHY;
  protected readonly PROVIDERS = PROVIDERS;
  protected readonly PRESETS_CHECKED = MODEL_PRICE_PRESETS_CHECKED;
  protected readonly BUILT_IN_GROUPS = [...new Set(BUILT_IN_PRICES.map((price) => price.provider))].map((provider) => ({
    provider,
    prices: BUILT_IN_PRICES.filter((price) => price.provider === provider),
  }));
  protected readonly PRESET_GROUPS = [...new Set(MODEL_PRICE_PRESETS.map((preset) => preset.provider))].map(
    (provider) => ({
      provider,
      presets: MODEL_PRICE_PRESETS.filter((preset) => preset.provider === provider).map((preset) => ({
        key: presetKey(preset),
        model: preset.model,
      })),
    }),
  );

  protected provider = signal<string>(CLAUDE_CODE_PROVIDER);
  protected presetKey = signal('');
  protected model = signal('');
  protected from = signal(calendarDayOf(new Date()));
  protected inputRate = signal<number | null>(null);
  protected outputRate = signal<number | null>(null);
  protected cacheWriteRate = signal<number | null>(null);
  protected cacheReadRate = signal<number | null>(null);

  protected currencies = computed(() => withStoredOption(CURRENCIES, this.table().currency));

  protected sorted = computed(() =>
    [...this.table().prices].sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model) || a.from.getTime() - b.from.getTime(),
    ),
  );

  protected typed = computed((): ModelPrice | null => {
    const model = this.model().trim();
    const from = dayStartOf(this.from());
    const inputRate = rateOf(this.inputRate());
    const outputRate = rateOf(this.outputRate());
    const cacheWrite = rateOf(this.cacheWriteRate());
    const cacheRead = rateOf(this.cacheReadRate());

    if (!model || !from || inputRate === null || outputRate === null || cacheWrite === null || cacheRead === null)
      return null;

    return { provider: this.provider(), model, from, input: inputRate, output: outputRate, cacheWrite, cacheRead };
  });

  protected DAY_OF(price: ModelPrice) {
    return calendarDayOf(price.from);
  }

  protected setCurrency(value: unknown) {
    if (typeof value === 'string' && value) this.currencyChange.emit(value);
  }

  protected applyPreset(key: unknown) {
    const preset = typeof key === 'string' ? presetByKey(key) : null;

    if (preset) this.fill(preset);
  }

  protected addTyped() {
    const price = this.typed();

    if (!price) return;

    this.add.emit(price);
    this.presetKey.set('');
    this.model.set('');
    this.inputRate.set(null);
    this.outputRate.set(null);
    this.cacheWriteRate.set(null);
    this.cacheReadRate.set(null);
  }

  private fill(preset: ModelPricePreset) {
    this.provider.set(preset.provider);
    this.model.set(preset.model);
    this.inputRate.set(preset.input);
    this.outputRate.set(preset.output);
    this.cacheWriteRate.set(preset.cacheWrite);
    this.cacheReadRate.set(preset.cacheRead);
  }
}
