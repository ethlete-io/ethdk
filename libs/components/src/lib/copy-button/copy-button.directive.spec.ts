import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { ButtonDirective } from '../button/headless/button.directive';
import { CopyButtonDirective } from './copy-button.directive';
import { provideCopyButtonLabels } from './copy-button-labels';
import { COPY_BUTTON_IMPORTS } from './copy-button.imports';

const stubClipboard = (clipboard: Partial<Clipboard> | undefined) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

@Component({
  selector: 'et-test-copy-button-host',
  template: `<button
    [text]="text()"
    [resetDelay]="resetDelay()"
    (copySucceed)="copyCount = copyCount + 1"
    (copyFail)="errorCount = errorCount + 1"
    etCopyButton
  >
    Copy
  </button>`,
  imports: [COPY_BUTTON_IMPORTS],
})
class CopyButtonHostComponent {
  public text = signal('hello');
  public resetDelay = signal(1200);
  public copyCount = 0;
  public errorCount = 0;
}

@Component({
  selector: 'et-test-copy-button-getter-host',
  template: `<button [text]="getText" etCopyButton>Copy</button>`,
  imports: [COPY_BUTTON_IMPORTS],
})
class CopyButtonGetterHostComponent {
  public value = 'initial';
  public getText = () => this.value;
}

@Component({
  selector: 'et-test-copy-button-loading-host',
  template: `<button etButton etCopyButton loading text="hello" type="button">Copy</button>`,
  imports: [COPY_BUTTON_IMPORTS, ButtonDirective],
})
class CopyButtonLoadingHostComponent {}

const button = (fixture: { nativeElement: HTMLElement }) => fixture.nativeElement.querySelector('button')!;

describe('CopyButtonDirective', () => {
  afterEach(() => {
    stubClipboard(undefined);
    vi.useRealTimers();
  });

  it('copies the text input on click and ticks copied()', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(button(fixture).getAttribute('data-copied')).toBe('true');
    expect(fixture.componentInstance.copyCount).toBe(1);
  });

  it('announces the copy through a polite live region next to the button', async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const region = button(fixture).nextElementSibling!;

    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(region.textContent).toBe('Copied');
    expect(button(fixture).textContent).not.toContain('Copied');
  });

  it('localizes the announcement', async () => {
    stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({ providers: [provideCopyButtonLabels({ copied: 'Kopiert' })] });

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(button(fixture).nextElementSibling!.textContent).toBe('Kopiert');
  });

  it('accepts a getter, evaluated at copy time', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const fixture = TestBed.createComponent(CopyButtonGetterHostComponent);
    fixture.detectChanges();

    fixture.componentInstance.value = 'updated';
    button(fixture).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('updated');
  });

  it('resets copied() after resetDelay', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.componentInstance.resetDelay.set(500);
    fixture.detectChanges();

    button(fixture).click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(button(fixture).getAttribute('data-copied')).toBe('true');

    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();

    expect(button(fixture).getAttribute('data-copied')).toBeNull();
  });

  it('drops a copy that is still pending when the host is destroyed', async () => {
    let settle: () => void = vi.fn();
    stubClipboard({ writeText: vi.fn(() => new Promise<void>((resolve) => (settle = resolve))) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();

    const directive = fixture.debugElement.query(By.directive(CopyButtonDirective)).injector.get(CopyButtonDirective);

    button(fixture).click();
    fixture.destroy();
    settle();
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).not.toHaveBeenCalled();
    expect(directive.copied()).toBe(false);

    warn.mockRestore();
  });

  it('does not tick copied() or emit when the copy fails', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    document.execCommand = vi.fn().mockReturnValue(false);

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();

    button(fixture).click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(button(fixture).getAttribute('data-copied')).toBeNull();
    expect(fixture.componentInstance.copyCount).toBe(0);
  });

  it('reports a failed copy through copyFail, data-copy-failed and the live region', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    document.execCommand = vi.fn().mockReturnValue(false);

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    button(fixture).click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const directive = fixture.debugElement.query(By.directive(CopyButtonDirective)).injector.get(CopyButtonDirective);

    expect(fixture.componentInstance.errorCount).toBe(1);
    expect(directive.copyFailed()).toBe(true);
    expect(button(fixture).getAttribute('data-copy-failed')).toBe('true');
    expect(button(fixture).nextElementSibling?.textContent).toBe('Copy failed');
  });

  it('exposes copied() read-only', () => {
    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    const directive = fixture.debugElement.query(By.directive(CopyButtonDirective)).injector.get(CopyButtonDirective);

    expect('set' in directive.copied).toBe(false);
  });

  it('reports a failure when writeText throws instead of rejecting', async () => {
    stubClipboard({
      writeText: vi.fn(() => {
        throw new TypeError('not allowed');
      }),
    });
    document.execCommand = vi.fn().mockReturnValue(false);

    const fixture = TestBed.createComponent(CopyButtonHostComponent);
    fixture.detectChanges();

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorCount).toBe(1);
    expect(button(fixture).getAttribute('data-copy-failed')).toBe('true');
  });

  it('copies nothing from a loading button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const fixture = TestBed.createComponent(CopyButtonLoadingHostComponent);
    fixture.detectChanges();

    button(fixture).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(writeText).not.toHaveBeenCalled();
    expect(button(fixture).getAttribute('data-copied')).toBeNull();
  });
});
