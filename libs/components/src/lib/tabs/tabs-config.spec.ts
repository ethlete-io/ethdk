import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeElementScroll, fakeIntersectionObserver, fakeResizeObserver } from '../testing/fake-layout';
import { TabGroupComponent } from './tabs/tab-group.component';
import { TabComponent } from './tabs/tab.component';
import { provideTabsConfig, TabUnderlineWidth } from './tabs-config';

@Component({
  imports: [TabGroupComponent, TabComponent],
  template: `
    <et-tab-group [activeUnderline]="activeUnderline()" [underlineWidth]="underlineWidth()">
      <et-tab label="One">One</et-tab>
    </et-tab-group>
  `,
})
class HostComponent {
  public activeUnderline = signal<boolean | undefined>(undefined);
  public underlineWidth = signal<TabUnderlineWidth | undefined>(undefined);
}

const setup = (providers: ReturnType<typeof provideTabsConfig> = [], inputs: Partial<HostComponent> = {}) => {
  TestBed.configureTestingModule({ providers });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.activeUnderline.set(inputs.activeUnderline?.());
  fixture.componentInstance.underlineWidth.set(inputs.underlineWidth?.());
  fixture.detectChanges();
  const el = fixture.nativeElement.querySelector('et-tab-group') as HTMLElement;
  return { underline: el.dataset['activeUnderline'], width: el.dataset['underlineWidth'] };
};

describe('provideTabsConfig', () => {
  beforeEach(() => {
    fakeResizeObserver();
    fakeIntersectionObserver();
    fakeElementScroll();
  });

  it('keeps the underline on and tab wide without a provider', () => {
    expect(setup()).toEqual({ underline: 'true', width: 'tab' });
  });

  it('applies the provided defaults', () => {
    expect(setup(provideTabsConfig({ activeUnderline: false, underlineWidth: 'label' }))).toEqual({
      underline: 'false',
      width: 'label',
    });
  });

  it('lets explicit inputs win over the provider', () => {
    const result = setup(provideTabsConfig({ activeUnderline: false, underlineWidth: 'label' }), {
      activeUnderline: signal<boolean | undefined>(true),
      underlineWidth: signal<TabUnderlineWidth | undefined>('tab'),
    });

    expect(result).toEqual({ underline: 'true', width: 'tab' });
  });
});
