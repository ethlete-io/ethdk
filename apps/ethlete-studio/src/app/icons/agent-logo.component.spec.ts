import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentLogoComponent } from './agent-logo.component';
import { AGENT_LOGOS } from './agent-logos';

@Component({
  template: `<svg class="size-3" agent="gemini" ethlete-agent-logo></svg>`,
  imports: [AgentLogoComponent],
})
class HostComponent {}

describe('AgentLogoComponent', () => {
  it('draws the shared logo of the agent as a hidden 24 by 24 svg', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);

    await fixture.whenStable();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');

    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('fill')).toBe(AGENT_LOGOS.gemini.fill);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(AGENT_LOGOS.gemini.path);
    expect(svg?.querySelector('path')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});
