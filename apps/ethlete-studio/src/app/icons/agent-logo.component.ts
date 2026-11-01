import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { AGENT_LOGOS, AgentLogoName } from './agent-logos';

@Component({
  selector: 'svg[ethlete-agent-logo]',
  template: `<svg:path [attr.d]="logo().path" />`,
  encapsulation: ViewEncapsulation.None,
  host: {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    '[attr.fill]': 'logo().fill',
  },
})
export class AgentLogoComponent {
  public agent = input.required<AgentLogoName>();

  protected logo = computed(() => AGENT_LOGOS[this.agent()]);
}
