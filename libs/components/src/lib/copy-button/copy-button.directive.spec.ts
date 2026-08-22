import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { CopyButtonDirective } from './copy-button.directive';
import { COPY_BUTTON_IMPORTS } from './copy-button.imports';

const stubClipboard = (clipboard: Partial<Clipboard> | undefined) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

@Component({
  selector: 'et-test-copy-button-host',
  template: `<button [text]="text()" [resetDelay]="resetDelay()" (copySuccess)="copyCount = copyCount + 1" etCopyButton>
    Copy
  </button>`,
  imports: [COPY_BUTTON_IMPORTS],
})
class CopyButtonHostComponent {
  public text = signal('hello');
  public resetDelay = signal(1200);
  public copyCount = 0;
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
});
