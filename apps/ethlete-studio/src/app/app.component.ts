import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatPanelComponent } from './chat/chat-panel.component';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex min-w-0 grow flex-col">
      <router-outlet />
    </div>
    <ethlete-chat-panel />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, ChatPanelComponent],
  host: { class: 'flex h-dvh overflow-hidden' },
})
export class AppComponent {}
