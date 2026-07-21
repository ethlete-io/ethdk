import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, ViewEncapsulation, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap, timer } from 'rxjs';
import { FormField, disabled, form, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import {
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_FILLS,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_LABEL_MODES,
  FORM_FIELD_SIZES,
  FormFieldAppearance,
  FormFieldFill,
  FormFieldLabelMode,
  FormFieldSize,
} from '../../form-field';
import { SELECT_IMPORTS } from '../select.imports';

const FRUIT_OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'dragonfruit', label: 'Dragonfruit' },
  { value: 'elderberry', label: 'Elderberry' },
  { value: 'fig', label: 'Fig' },
  { value: 'grape', label: 'Grape' },
] as const;

@Component({
  selector: 'et-sb-form-field-select',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        <et-select
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [placeholder]="placeholder()"
          [multiple]="multiple()"
          [allowCustomValues]="allowCustomValues()"
          [customValueSeparators]="customValueSeparators()"
          [commitCustomValueOnClose]="commitCustomValueOnClose()"
          [maxSelection]="maxSelection()"
        >
          @if (withSearch()) {
            <input etSelectSearch placeholder="Search fruits" />
          }
          @for (fruit of FRUITS; track fruit.value) {
            <et-select-option [value]="fruit.value" [disabled]="fruit.value === disabledOption()">
              {{ fruit.label }}
            </et-select-option>
          }
        </et-select>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.value().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      } @else {
        <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Fruit');
  public placeholder = input('Pick a fruit');
  public hint = input('');
  public value = input<string | string[] | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public multiple = input(false);
  public withSearch = input(false);
  public allowCustomValues = input(false);
  public customValueSeparators = input<string[]>([]);
  public commitCustomValueOnClose = input(false);
  public maxSelection = input<number | undefined>(undefined);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public disabledOption = input('elderberry');
  public color = input('brand');

  protected readonly FRUITS = FRUIT_OPTIONS;

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({
    value: this.multiple() ? ((this.value() as string[] | null) ?? []) : this.value(),
  }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}

@Component({
  selector: 'et-sb-form-field-select-async',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans" etProvideColor="brand">
      <et-form-field>
        <et-label>User</et-label>
        <et-select
          [formField]="demoForm.value"
          [loading]="loading()"
          [error]="error()"
          [hasMoreItems]="hasMore()"
          (queryChange)="search($event)"
          (loadMore)="loadMore()"
          filterMode="external"
          placeholder="Search for a user"
        >
          <input etSelectSearch placeholder="Type to search…" />
          @for (user of shownUsers(); track user) {
            <et-select-option [value]="user">{{ user }}</et-select-option>
          }
        </et-select>
        <et-hint>Options load from a simulated backend (600ms latency)</et-hint>
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectAsyncStorybookComponent {
  private destroyRef = inject(DestroyRef);
  protected loading = signal(false);
  protected shownUsers = signal<string[]>([]);
  protected hasMore = signal(false);
  protected error = signal<string | null>(null);

  private formModel = linkedSignal(() => ({ value: null as string | null }));
  public demoForm = form(this.formModel);
  private requestId = 0;
  private readonly PAGE_SIZE = 4;
  private currentQuery = '';
  private shownCount = this.PAGE_SIZE;

  constructor() {
    // preload the first page so the popup has options on first open
    this.request();
  }

  protected search(query: string) {
    this.currentQuery = query;
    this.shownCount = this.PAGE_SIZE;
    this.request();
  }

  protected loadMore() {
    this.shownCount += this.PAGE_SIZE;
    this.request();
  }

  private request() {
    const id = ++this.requestId;

    this.loading.set(true);
    this.error.set(null);

    timer(600)
      .pipe(
        tap(() => {
          if (id !== this.requestId) {
            return;
          }

          const matches = ALL_USERS.filter((user) => user.toLowerCase().includes(this.currentQuery.toLowerCase()));

          this.shownUsers.set(matches.slice(0, this.shownCount));
          this.hasMore.set(matches.length > this.shownCount);
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

const ALL_USERS = [
  'Ada Lovelace',
  'Alan Turing',
  'Anita Borg',
  'Barbara Liskov',
  'Dennis Ritchie',
  'Donald Knuth',
  'Edsger Dijkstra',
  'Grace Hopper',
  'John von Neumann',
  'Katherine Johnson',
  'Ken Thompson',
  'Margaret Hamilton',
];

@Component({
  selector: 'et-sb-form-field-select-country',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans" etProvideColor="brand">
      <et-form-field>
        <et-label>Country</et-label>
        <et-select [formField]="demoForm.value" placeholder="Pick a country">
          <input etSelectSearch placeholder="Search countries" />

          <ng-template etSelectValue let-entries>
            @for (entry of entries; track entry.value) {
              <span class="flex items-center gap-2">
                <span aria-hidden="true">{{ flagOf(entry.value) }}</span>
                {{ entry.label }}
              </span>
            }
          </ng-template>

          @for (country of COUNTRIES; track country.iso) {
            <et-select-option [value]="country.iso" [label]="country.name">
              <span aria-hidden="true">{{ country.flag }}</span>
              {{ country.name }}
            </et-select-option>
          }
        </et-select>
        <et-hint>Custom option and value rendering (flags) + search</et-hint>
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectCountryStorybookComponent {
  protected readonly COUNTRIES = COUNTRY_OPTIONS;

  private formModel = linkedSignal(() => ({ value: 'de' as string | null }));
  public demoForm = form(this.formModel);

  protected flagOf(iso: unknown) {
    return COUNTRY_OPTIONS.find((country) => country.iso === iso)?.flag ?? '';
  }
}

@Component({
  selector: 'et-sb-form-field-select-add-new',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans" etProvideColor="brand">
      <et-form-field>
        <et-label>Project</et-label>
        <et-select
          [formField]="demoForm.value"
          [allowAddNew]="true"
          (addNew)="createProject($event)"
          addNewLabel="Create a new project"
          placeholder="Pick a project"
        >
          <input etSelectSearch placeholder="Search projects" />
          @for (project of projects(); track project) {
            <et-select-option [value]="project">{{ project }}</et-select-option>
          }
        </et-select>
        <et-hint>The add-new row emits the current query — here it creates and selects the option</et-hint>
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectAddNewStorybookComponent {
  protected projects = signal(['Website relaunch', 'Mobile app', 'Design system']);

  private formModel = linkedSignal(() => ({ value: null as string | null }));
  public demoForm = form(this.formModel);

  protected createProject(query: string) {
    // a real app would open a creation dialog here — the emitted query prefills it
    const name = query || `Project ${this.projects().length + 1}`;

    if (!this.projects().includes(name)) {
      this.projects.update((projects) => [...projects, name]);
    }

    this.formModel.set({ value: name });
  }
}

@Component({
  selector: 'et-sb-form-field-select-many-options',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans" etProvideColor="brand">
      <et-form-field>
        <et-label>Item</et-label>
        <et-select [formField]="demoForm.value" [options]="ITEMS" placeholder="Pick an item">
          <input etSelectSearch placeholder="Search 2000 items" />
        </et-select>
        <et-hint>2000 options via the data-driven API — only the rows near the viewport are in the DOM</et-hint>
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectManyOptionsStorybookComponent {
  protected readonly ITEMS = Array.from({ length: 2000 }, (_, index) => ({
    value: `item-${index + 1}`,
    label: `Item ${index + 1} — ${FRUIT_OPTIONS[index % FRUIT_OPTIONS.length]!.label}`,
  }));

  private formModel = linkedSignal(() => ({ value: null as string | null }));
  public demoForm = form(this.formModel);
}

const FIRST_NAMES = ['Alex', 'Chris', 'Dana', 'Eli', 'Femi', 'Ines', 'Jona', 'Kim', 'Lior', 'Mara'];
const LAST_NAMES = ['Adler', 'Berg', 'Castro', 'Diaz', 'Egede', 'Fuchs', 'Grau', 'Haas', 'Ito', 'Juhl'];

@Component({
  selector: 'et-sb-form-field-select-option-template',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans" etProvideColor="brand">
      <et-form-field>
        <et-label>Assignee</et-label>
        <et-select [formField]="demoForm.value" [options]="USERS" placeholder="Pick a user">
          <input etSelectSearch placeholder="Search 1000 users" />
          <ng-template etSelectOptionTemplate let-user>
            <span class="flex items-center gap-2 py-1">
              <span class="flex size-6 flex-none items-center justify-center rounded-full bg-white/10 text-[10px]">
                {{ user.initials }}
              </span>
              <span class="flex min-w-0 flex-col leading-tight">
                <span class="truncate">{{ user.label }}</span>
                <span class="truncate text-[11px] opacity-60">{{ user.email }}</span>
              </span>
            </span>
          </ng-template>
        </et-select>
        <et-hint>Windowed rows render through etSelectOptionTemplate — extra option fields stay available</et-hint>
      </et-form-field>

      <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...SELECT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class FormFieldSelectOptionTemplateStorybookComponent {
  protected readonly USERS = Array.from({ length: 1000 }, (_, index) => {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]!;
    const name = `${firstName} ${lastName}`;

    return {
      value: `user-${index + 1}`,
      label: `${name} ${index + 1}`,
      initials: `${firstName[0]}${lastName[0]}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index + 1}@example.com`,
    };
  });

  private formModel = linkedSignal(() => ({ value: null as string | null }));
  public demoForm = form(this.formModel);
}

const COUNTRY_OPTIONS = [
  { iso: 'br', name: 'Brazil', flag: '🇧🇷' },
  { iso: 'de', name: 'Germany', flag: '🇩🇪' },
  { iso: 'es', name: 'Spain', flag: '🇪🇸' },
  { iso: 'fr', name: 'France', flag: '🇫🇷' },
  { iso: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { iso: 'it', name: 'Italy', flag: '🇮🇹' },
  { iso: 'jp', name: 'Japan', flag: '🇯🇵' },
  { iso: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { iso: 'no', name: 'Norway', flag: '🇳🇴' },
  { iso: 'pl', name: 'Poland', flag: '🇵🇱' },
  { iso: 'se', name: 'Sweden', flag: '🇸🇪' },
  { iso: 'us', name: 'United States', flag: '🇺🇸' },
];
