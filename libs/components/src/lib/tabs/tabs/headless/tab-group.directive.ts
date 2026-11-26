import {
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError, canUseSessionMemory, createSessionMemory, signalElementMutations } from '@ethlete/core';
import { isSameOrder, sortByDomOrder } from '../../../internals/dom-order';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TAB_ERROR_CODES } from '../../tab-errors';
import { TAB_GROUP_TOKEN } from './tab-group.tokens';
import { TabPanelDirective } from './tab-panel.directive';

const ET_TAB_GROUP_SESSION_MEMORY_PREFIX = 'et-tab-group:';

@Directive({
  selector: '[etTabGroup]',
  providers: [{ provide: TAB_GROUP_TOKEN, useExisting: TabGroupDirective }],
})
export class TabGroupDirective {
  public tabBar = inject(TabBarDirective);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public preserveContent = input(true, { transform: booleanAttribute });
  public selectedIndex = model(0);
  /** Session storage key under which the selected tab is remembered; the stored tab wins over the initial `selectedIndex`. Nothing is stored while it is `null`. */
  public sessionMemoryKey = input<string | null>(null);
  private sessionMemoryAvailable = canUseSessionMemory();

  private registeredPanels = signal<TabPanelDirective[]>([]);

  private childMutations = signalElementMutations(inject<ElementRef<HTMLElement>>(ElementRef), {
    childList: true,
    subtree: true,
  });

  /** @internal The panels in DOM order, which a keyed `@for` can change without re-registering any. */
  public panels = computed(
    () => {
      this.childMutations();

      return sortByDomOrder(this.registeredPanels(), (panel) => panel.hostElement);
    },
    { equal: isSameOrder },
  );

  /** @internal Set by composing components (e.g. et-tab-group) that render panel content themselves instead of registering [etTabPanel] directives. */
  public managesPanelsInternally = signal(false);

  /** @internal */
  public restoredSessionMemoryKey = signal<string | null>(null);

  constructor() {
    effect(() => {
      const selectedIndex = this.selectedIndex();

      untracked(() => {
        if (this.tabBar.selectedIndex() !== selectedIndex) {
          this.tabBar.selectedIndex.set(selectedIndex);
        }
      });
    });

    effect(() => {
      const selectedIndex = this.tabBar.selectedIndex();

      untracked(() => {
        if (this.selectedIndex() !== selectedIndex) {
          this.selectedIndex.set(selectedIndex);
        }
      });
    });

    effect(() => {
      const selectedIndex = this.selectedIndex();
      const triggerCount = this.tabBar.triggers().length;

      if (triggerCount === 0) {
        return;
      }

      const resolvedSelectedIndex = this.resolveSelectedIndex(selectedIndex);

      if (resolvedSelectedIndex === null || resolvedSelectedIndex === selectedIndex) {
        return;
      }

      untracked(() => {
        this.selectedIndex.set(resolvedSelectedIndex);
      });
    });

    effect(() => {
      if (!this.sessionMemoryAvailable) {
        return;
      }

      const sessionMemoryKey = this.sessionMemoryKey();
      const restoredSessionMemoryKey = this.restoredSessionMemoryKey();
      const triggerCount = this.tabBar.triggers().length;

      if (sessionMemoryKey === null || triggerCount === 0 || restoredSessionMemoryKey === sessionMemoryKey) {
        return;
      }

      const storedSelectedIndex = this.getSessionMemory(sessionMemoryKey).read();
      const resolvedSelectedIndex = this.resolveSelectedIndex(storedSelectedIndex ?? this.selectedIndex());

      untracked(() => {
        this.restoredSessionMemoryKey.set(sessionMemoryKey);

        if (resolvedSelectedIndex !== null && this.selectedIndex() !== resolvedSelectedIndex) {
          this.selectedIndex.set(resolvedSelectedIndex);
        }
      });
    });

    effect(() => {
      if (!this.sessionMemoryAvailable) {
        return;
      }

      const sessionMemoryKey = this.sessionMemoryKey();
      const restoredSessionMemoryKey = this.restoredSessionMemoryKey();
      const selectedIndex = this.selectedIndex();
      const triggerCount = this.tabBar.triggers().length;

      if (sessionMemoryKey === null || restoredSessionMemoryKey !== sessionMemoryKey || triggerCount === 0) {
        return;
      }

      const resolvedSelectedIndex = this.resolveSelectedIndex(selectedIndex);

      if (resolvedSelectedIndex === null) {
        return;
      }

      this.getSessionMemory(sessionMemoryKey).write(resolvedSelectedIndex);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.managesPanelsInternally() && this.tabBar.triggers().length > 0 && this.panels().length === 0) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_TAB_PANEL,
            '[TabGroupDirective] The tab group has tab triggers but no [etTabPanel] was registered. Add a panel per tab.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public registerPanel(panel: TabPanelDirective) {
    this.registeredPanels.update((list) => [...list, panel]);
  }

  /** @internal */
  public unregisterPanel(panel: TabPanelDirective) {
    this.registeredPanels.update((list) => list.filter((p) => p !== panel));
  }

  private resolveSelectedIndex(index: number) {
    const triggers = this.tabBar.triggers();

    if (triggers.length === 0) {
      return null;
    }

    const wholeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
    const clampedIndex = Math.min(Math.max(wholeIndex, 0), triggers.length - 1);
    const selectedTrigger = triggers[clampedIndex];

    if (selectedTrigger && !selectedTrigger.disabled()) {
      return clampedIndex;
    }

    for (let distance = 1; distance < triggers.length; distance++) {
      for (const candidateIndex of [clampedIndex - distance, clampedIndex + distance]) {
        const trigger = triggers[candidateIndex];

        if (trigger && !trigger.disabled()) {
          return candidateIndex;
        }
      }
    }

    return null;
  }

  private getSessionMemoryStorageKey(sessionMemoryKey: string) {
    return `${ET_TAB_GROUP_SESSION_MEMORY_PREFIX}${sessionMemoryKey}`;
  }

  private getSessionMemory(sessionMemoryKey: string) {
    return createSessionMemory<number>({
      key: this.getSessionMemoryStorageKey(sessionMemoryKey),
      parse: (storedSelectedIndex) => this.parseSelectedIndex(storedSelectedIndex),
      serialize: (selectedIndex) => String(selectedIndex),
    });
  }

  private parseSelectedIndex(storedSelectedIndex: string) {
    const parsedSelectedIndex = Number.parseInt(storedSelectedIndex, 10);

    if (!Number.isInteger(parsedSelectedIndex)) {
      return null;
    }

    return parsedSelectedIndex;
  }
}
