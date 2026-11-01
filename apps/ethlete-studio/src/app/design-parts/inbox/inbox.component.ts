import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, SWITCH_IMPORTS, TEXTAREA_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { ShellMainComponent } from '../shell-main/shell-main.component';
import { INBOX_SAMPLE, InboxComment } from './inbox-sample';

export type InboxOpenOn = 'all' | 'active' | 'others' | 'none';

@Component({
  selector: 'ethlete-inbox',
  templateUrl: './inbox.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    SWITCH_IMPORTS,
    TEXTAREA_IMPORTS,
    AutoSurfaceDirective,
    NgTemplateOutlet,
    ShellMainComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class InboxComponent {
  public comments = input<InboxComment[]>(INBOX_SAMPLE);
  public activePart = input('button');
  public selectedId = input<string | null>('c1');
  public product = input('studio');
  public showResolved = model(false);
  public openOn = input<InboxOpenOn>('all');
  public draft = input(false);
  public entry = input(false);

  public collapse = output();
  public send = output<string>();

  protected readonly DRAFT_TEXT = 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.';

  public inScope = computed(() => {
    const openOn = this.openOn();
    const active = this.activePart();

    return this.comments().filter(
      (c) =>
        c.resolved ||
        openOn === 'all' ||
        (openOn === 'active' && c.part === active) ||
        (openOn === 'others' && c.part !== active),
    );
  });

  protected visible = computed(() => this.inScope().filter((c) => this.showResolved() || !c.resolved));
  protected openCount = computed(() => this.inScope().filter((c) => !c.resolved).length);
  protected onActivePart = computed(() => this.visible().filter((c) => c.part === this.activePart()));
  protected onOtherParts = computed(() => this.visible().filter((c) => c.part !== this.activePart()));
  protected editorOpen = computed(() => this.draft() || this.entry());
}
