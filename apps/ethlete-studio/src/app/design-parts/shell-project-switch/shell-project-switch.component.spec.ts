import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { ShellProjectSwitchComponent } from './shell-project-switch.component';

describe('ShellProjectSwitchComponent', () => {
  it('closes the picker when the current project is chosen again', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(ShellProjectSwitchComponent);

    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    const option = document.querySelector<HTMLElement>('[role="menuitemradio"]');

    expect(option).not.toBeNull();

    option?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
  });
});
