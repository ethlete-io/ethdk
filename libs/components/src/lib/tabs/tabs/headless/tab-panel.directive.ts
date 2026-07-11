import { Directive, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TAB_ERROR_CODES } from '../../tab-errors';
import { TAB_GROUP_TOKEN, TAB_PANEL_TOKEN } from './tab-group.tokens';

let nextPanelId = 0;

@Directive({
  selector: '[etTabPanel]',
  providers: [{ provide: TAB_PANEL_TOKEN, useExisting: TabPanelDirective }],
  host: {
    role: 'tabpanel',
    '[attr.id]': 'ID',
    '[attr.aria-labelledby]': 'triggerId()',
    '[attr.inert]': 'isInactive() || null',
    '[attr.hidden]': 'isHidden() || null',
  },
})
export class TabPanelDirective {
  private tabGroup = inject(TAB_GROUP_TOKEN, { optional: true });

  public triggerId = input<string | null>(null);
  public readonly ID = `et-tab-panel-${nextPanelId++}`;

  public isActive = computed(() => {
    const tabGroup = this.tabGroup;

    if (!tabGroup) {
      return false;
    }

    const idx = tabGroup.panels().indexOf(this);

    return idx === tabGroup.tabBar.selectedIndex();
  });

  public isInactive = computed(() => !this.isActive());

  public isHidden = computed(() => {
    if (this.tabGroup?.preserveContent()) {
      return !this.isActive();
    }

    return false;
  });

  public shouldRender = computed(() => {
    const tabGroup = this.tabGroup;

    if (!tabGroup) {
      return false;
    }

    if (tabGroup.preserveContent()) {
      return true;
    }

    return this.isActive();
  });

  constructor() {
    effect(() => {
      this.tabGroup?.registerPanel(this);

      return () => this.tabGroup?.unregisterPanel(this);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tabGroup) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_TAB_GROUP,
            '[TabPanelDirective] etTabPanel must be placed inside an [etTabGroup] element (e.g. et-tab-group).',
          );
        }
      });
    }
  }
}
