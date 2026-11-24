import { booleanAttribute, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { START_LABELS, StartAccent, StartBase, StartColors } from '../../i18n/start-labels';

@Component({
  selector: 'ethlete-start',
  template: `
    <header class="flex items-center gap-space-3 p-space-4">
      <svg [attr.aria-label]="LABELS.title" width="24" height="24" viewBox="0 0 32 32" role="img">
        <g color="#051211">
          <rect width="32" height="32" rx="8" fill="#25aea7" />
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M11.5 5.5H24.1C26 5.5 27 6.9 26.4 8.7L22.8 20.9C22.5 22 21.8 22.9 20.8 23.4L8 28L9 21.6L5.9 17.4C5.2 16.5 5.2 15.2 5.9 14.2L9.4 6.8C9.8 6 10.6 5.5 11.5 5.5ZM12.8 11.5C12 11.3 11.2 11.8 11 12.6L10.2 15.7C10 16.5 10.5 17.3 11.3 17.5C12.1 17.7 12.9 17.2 13.1 16.4L13.9 13.3C14.1 12.5 13.6 11.7 12.8 11.5ZM20.1 10.6C19.3 10.4 18.5 10.9 18.3 11.7L17.5 14.8C17.3 15.6 17.8 16.4 18.6 16.6C19.4 16.8 20.2 16.3 20.4 15.5L21.2 12.4C21.4 11.6 20.9 10.8 20.1 10.6Z"
          />
        </g>
      </svg>
      <span class="text-et-surface font-ui-strong text-ui-md">{{ LABELS.title }}</span>
      @if (repo(); as name) {
        <span class="text-et-surface-muted text-ui-sm">{{ name }}</span>
        <button [loading]="busy()" (click)="otherRepo.emit()" et-button type="button" variant="transparent" size="sm">
          {{ LABELS.otherRepo }}
        </button>
      }
    </header>
    <div class="flex-1 flex items-center justify-center">
      <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
        @if (repo(); as name) {
          <div class="flex items-center gap-space-2" aria-hidden="true">
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
          </div>
          <p class="m-0 text-et-surface font-ui-strong text-ui-md">{{ LABELS.noProducts }}</p>
          <p class="m-0 text-et-surface-muted">{{ LABELS.productExplainer }}</p>
          <div class="flex flex-col items-center gap-space-2">
            <p class="m-0 text-et-surface font-ui-strong text-ui-sm">{{ LABELS.colorsQuestion }}</p>
            <div
              [attr.aria-label]="LABELS.colorsQuestion"
              class="flex flex-wrap justify-center gap-space-2"
              role="group"
            >
              @for (scheme of COLORS; track scheme) {
                <button
                  [pressed]="colors() === scheme"
                  (click)="colors.set(scheme)"
                  et-button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  {{ LABELS.colors[scheme] }}
                </button>
              }
            </div>
          </div>
          <div class="flex flex-col items-center gap-space-2">
            <p class="m-0 text-et-surface font-ui-strong text-ui-sm">{{ LABELS.accentQuestion }}</p>
            <div
              [attr.aria-label]="LABELS.accentQuestion"
              class="flex flex-wrap justify-center gap-space-2"
              role="group"
            >
              @for (item of LABELS.accents; track item.name) {
                <button
                  [pressed]="accent() === item.name"
                  (click)="accent.set(item.name)"
                  et-button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  <span [style.background]="item.hex" class="block size-3 rounded-full" etIcon></span>
                  {{ item.name }}
                </button>
              }
            </div>
          </div>
          <div class="flex flex-col items-center gap-space-2">
            <p class="m-0 text-et-surface font-ui-strong text-ui-sm">{{ LABELS.baseQuestion }}</p>
            <div [attr.aria-label]="LABELS.baseQuestion" class="flex flex-wrap justify-center gap-space-2" role="group">
              @for (item of BASES; track item) {
                <button
                  [pressed]="base() === item"
                  (click)="base.set(item)"
                  et-button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  {{ LABELS.bases[item] }}
                </button>
              }
            </div>
          </div>
          <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-bg text-et-surface text-ui-sm">
            {{ LABELS.prompt({ repo: name, colors: colors(), accent: accentItem(), base: base() }) }}
          </p>
          <button
            (click)="
              copyPrompt.emit(LABELS.prompt({ repo: name, colors: colors(), accent: accentItem(), base: base() }))
            "
            et-button
            type="button"
            variant="outline"
            size="sm"
          >
            {{ LABELS.copyPrompt }}
          </button>
          @if (others().length) {
            <p class="m-0 text-et-surface-muted text-ui-sm">{{ LABELS.knownRepos }}</p>
            <div class="flex flex-wrap justify-center gap-space-2">
              @for (name of others(); track name) {
                <button
                  [disabled]="busy()"
                  (click)="projectChange.emit(name)"
                  et-button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  {{ name }}
                </button>
              }
            </div>
          }
        } @else {
          <p class="m-0 text-et-surface font-ui-strong text-ui-md">{{ LABELS.noRepo }}</p>
          <p class="m-0 text-et-surface-muted">{{ LABELS.repoExplainer }}</p>
          <button [loading]="busy()" (click)="openRepo.emit()" et-button type="button" variant="filled">
            {{ LABELS.openRepo }}
          </button>
          @if (others().length) {
            <p class="m-0 text-et-surface-muted text-ui-sm">{{ LABELS.knownRepos }}</p>
            <div class="flex flex-wrap justify-center gap-space-2">
              @for (name of others(); track name) {
                <button
                  [disabled]="busy()"
                  (click)="projectChange.emit(name)"
                  et-button
                  type="button"
                  variant="outline"
                  size="sm"
                >
                  {{ name }}
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  host: { class: 'flex font-ui h-full min-h-225 w-full flex-col bg-et-surface-bg' },
})
export class StartComponent {
  public repo = input<string | undefined>();
  public repos = input<readonly string[]>([]);
  public busy = input(false, { transform: booleanAttribute });
  public colors = model<StartColors>('both');
  public accent = model<string>(START_LABELS.accents[0].name);
  public base = model<StartBase | undefined>();
  public openRepo = output();
  public otherRepo = output();
  public copyPrompt = output<string>();
  public projectChange = output<string>();

  protected accentItem = computed<StartAccent>(
    () => START_LABELS.accents.find((item) => item.name === this.accent()) ?? START_LABELS.accents[0],
  );
  protected others = computed(() => this.repos().filter((name) => name !== this.repo()));

  protected readonly LABELS = START_LABELS;
  protected readonly COLORS: readonly StartColors[] = ['light', 'dark', 'both'];
  protected readonly BASES: readonly StartBase[] = ['sdk', 'own'];
}
