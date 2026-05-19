import { Directive, computed, effect, inject, input } from '@angular/core';
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
  private tabGroup = inject(TAB_GROUP_TOKEN);

  public triggerId = input<string | null>(null);
  public readonly ID = `et-tab-panel-${nextPanelId++}`;

  public isActive = computed(() => {
    const idx = this.tabGroup.panels().indexOf(this);

    return idx === this.tabGroup.tabBar.selectedIndex();
  });

  public isInactive = computed(() => !this.isActive());

  public isHidden = computed(() => {
    if (this.tabGroup.preserveContent()) {
      return !this.isActive();
    }

    return false;
  });

  public shouldRender = computed(() => {
    if (this.tabGroup.preserveContent()) {
      return true;
    }

    return this.isActive();
  });

  constructor() {
    effect(() => {
      this.tabGroup.registerPanel(this);

      return () => this.tabGroup.unregisterPanel(this);
    });
  }
}
