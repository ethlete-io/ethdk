import { Directive, ElementRef, effect, inject, input, model, signal, untracked } from '@angular/core';
import { canUseSessionMemory, createAutoSessionMemoryKey, createSessionMemory } from '@ethlete/core';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TAB_GROUP_TOKEN } from './tab-group.tokens';
import { TabPanelDirective } from './tab-panel.directive';

const ET_TAB_GROUP_AUTO_SESSION_MEMORY_PREFIX = 'tab-group';
const ET_TAB_GROUP_SESSION_MEMORY_PREFIX = 'et-tab-group:';

@Directive({
  selector: '[etTabGroup]',
  providers: [{ provide: TAB_GROUP_TOKEN, useExisting: TabGroupDirective }],
})
export class TabGroupDirective {
  public tabBar = inject(TabBarDirective);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  preserveContent = input(true);
  selectedIndex = model(0);
  sessionMemoryKey = input<string | null>(null);
  private sessionMemoryAvailable = canUseSessionMemory();

  /** @internal */
  panels = signal<TabPanelDirective[]>([]);

  restoredSessionMemoryKey = signal('');

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

      const sessionMemoryKey = this.getResolvedSessionMemoryKey();
      const restoredSessionMemoryKey = this.restoredSessionMemoryKey();
      const triggerCount = this.tabBar.triggers().length;

      if (triggerCount === 0 || restoredSessionMemoryKey === sessionMemoryKey) {
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

      const sessionMemoryKey = this.getResolvedSessionMemoryKey();
      const restoredSessionMemoryKey = this.restoredSessionMemoryKey();
      const selectedIndex = this.selectedIndex();
      const triggerCount = this.tabBar.triggers().length;

      if (restoredSessionMemoryKey !== sessionMemoryKey || triggerCount === 0) {
        return;
      }

      const resolvedSelectedIndex = this.resolveSelectedIndex(selectedIndex);

      if (resolvedSelectedIndex === null) {
        return;
      }

      this.getSessionMemory(sessionMemoryKey).write(resolvedSelectedIndex);
    });
  }

  /** @internal */
  registerPanel(panel: TabPanelDirective) {
    this.panels.update((list) => [...list, panel]);
  }

  /** @internal */
  unregisterPanel(panel: TabPanelDirective) {
    this.panels.update((list) => list.filter((p) => p !== panel));
  }

  private resolveSelectedIndex(index: number) {
    const triggers = this.tabBar.triggers();

    if (triggers.length === 0) {
      return null;
    }

    const clampedIndex = Math.min(Math.max(index, 0), triggers.length - 1);
    const selectedTrigger = triggers[clampedIndex];

    if (selectedTrigger && !selectedTrigger.disabled()) {
      return clampedIndex;
    }

    for (let currentIndex = 0; currentIndex < triggers.length; currentIndex++) {
      const trigger = triggers[currentIndex];

      if (trigger && !trigger.disabled()) {
        return currentIndex;
      }
    }

    return null;
  }

  private getSessionMemoryStorageKey(sessionMemoryKey: string) {
    return `${ET_TAB_GROUP_SESSION_MEMORY_PREFIX}${sessionMemoryKey}`;
  }

  private getResolvedSessionMemoryKey() {
    return (
      this.sessionMemoryKey() ??
      createAutoSessionMemoryKey({
        element: this.elementRef.nativeElement,
        prefix: ET_TAB_GROUP_AUTO_SESSION_MEMORY_PREFIX,
      })
    );
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
