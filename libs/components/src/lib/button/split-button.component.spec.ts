import { ApplicationRef, Component, ErrorHandler, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { BUTTON_IMPORTS } from './button.imports';
import { SplitButtonDirective } from './headless';

@Component({
  template: `
    <et-split-button>
      <button et-button etSplitButtonAction type="button">Save</button>

      @if (showTrigger()) {
        <button et-icon-button etSplitButtonTrigger type="button" aria-label="More save options">v</button>
      }
    </et-split-button>
  `,
  imports: [...BUTTON_IMPORTS],
})
class SplitButtonTestHost {
  showTrigger = signal(true);
}

@Component({
  template: `<et-split-button></et-split-button>`,
  imports: [...BUTTON_IMPORTS],
})
class SplitButtonEmptyTestHost {}

@Component({
  template: `<button et-button etSplitButtonAction type="button">Save</button>`,
  imports: [...BUTTON_IMPORTS],
})
class SplitButtonOrphanActionTestHost {}

describe('SplitButtonComponent', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  describe('with both segments', () => {
    let fixture: ComponentFixture<SplitButtonTestHost>;
    let host: HTMLElement;
    let splitButton: SplitButtonDirective;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [SplitButtonTestHost] });
      fixture = TestBed.createComponent(SplitButtonTestHost);
      fixture.detectChanges();
      host = fixture.nativeElement.querySelector('et-split-button');
      splitButton = fixture.debugElement.query(By.directive(SplitButtonDirective)).injector.get(SplitButtonDirective);
    });

    it('renders as a group', () => {
      expect(host.classList).toContain('et-split-button');
      expect(host.getAttribute('role')).toBe('group');
    });

    it('marks the segments', () => {
      expect(host.querySelector('.et-split-button-action')?.textContent).toContain('Save');
      expect(host.querySelector('.et-split-button-trigger')?.getAttribute('aria-label')).toBe('More save options');
    });

    it('registers both segments', () => {
      expect(splitButton.registeredAction()).not.toBeNull();
      expect(splitButton.registeredTrigger()).not.toBeNull();
    });

    it('unregisters a segment when it is removed', () => {
      fixture.componentInstance.showTrigger.set(false);
      fixture.detectChanges();

      expect(splitButton.registeredTrigger()).toBeNull();
      expect(splitButton.registeredAction()).not.toBeNull();
    });
  });

  describe('dev mode enforcement', () => {
    class CollectingErrorHandler implements ErrorHandler {
      errors: unknown[] = [];

      handleError(error: unknown) {
        this.errors.push(error);
      }
    }

    const renderAndCollectErrors = (host: typeof SplitButtonEmptyTestHost | typeof SplitButtonOrphanActionTestHost) => {
      TestBed.configureTestingModule({
        imports: [host],
        providers: [{ provide: ErrorHandler, useClass: CollectingErrorHandler }],
      });

      const fixture = TestBed.createComponent(host);

      fixture.detectChanges();
      tick();

      return (TestBed.inject(ErrorHandler) as CollectingErrorHandler).errors;
    };

    it('errors when the required segments are missing', () => {
      const errors = renderAndCollectErrors(SplitButtonEmptyTestHost);

      expect(errors.some((error) => String(error).includes('ET2300'))).toBe(true);
    });

    it('errors when a segment is used outside a split button', () => {
      const errors = renderAndCollectErrors(SplitButtonOrphanActionTestHost);

      expect(errors.some((error) => String(error).includes('ET2302'))).toBe(true);
    });
  });
});
