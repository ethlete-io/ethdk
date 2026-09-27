import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENTS_VERSION } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-about-footer',
  template: `<footer>UI kit v{{ version }}</footer>`,
})
class AboutFooterComponent {
  version = COMPONENTS_VERSION;
}

describe('version scenarios', () => {
  const scenario = useScenario();

  it('reports the version of the published package an app shows in its footer', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AboutFooterComponent);
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as { version: string };

    s.tick();

    expect(COMPONENTS_VERSION).toBe(pkg.version);
    expect((fixture.nativeElement as HTMLElement).textContent).toBe(`UI kit v${pkg.version}`);
  });
});
