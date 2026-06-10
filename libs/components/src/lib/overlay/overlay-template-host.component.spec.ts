import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { OverlaySurfaceContext } from './headless/overlay-surface.directive';
import { OverlayTemplateHostComponent } from './overlay-template-host.component';

@Component({
  template: `
    <ng-template #content let-message="message">
      <span class="projected-message">{{ message }}</span>
    </ng-template>
  `,
})
class OverlayTemplateContentTestHost {
  template = viewChild.required<TemplateRef<{ message: string }>>('content');
}

describe('OverlayTemplateHostComponent', () => {
  let fixture: ComponentFixture<OverlayTemplateHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayTemplateContentTestHost],
    });

    const contentFixture = TestBed.createComponent(OverlayTemplateContentTestHost);
    contentFixture.detectChanges();

    const template = contentFixture.componentInstance.template() as unknown as TemplateRef<OverlaySurfaceContext>;
    const context = {
      $implicit: null as never,
      overlay: null as never,
      close: () => undefined,
      message: 'Rendered through ngTemplateOutlet',
    } as OverlaySurfaceContext & { message: string };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [OverlayTemplateHostComponent],
    });

    fixture = TestBed.createComponent(OverlayTemplateHostComponent);
    fixture.componentRef.setInput('template', template);
    fixture.componentRef.setInput('context', context);
  });

  it('renders the provided template with the injected context', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.projected-message')?.textContent).toContain(
      'Rendered through ngTemplateOutlet',
    );
  });
});
