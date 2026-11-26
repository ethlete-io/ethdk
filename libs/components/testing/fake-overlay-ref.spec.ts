import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import '../src/test-helpers';
import { defineOverlay } from '@ethlete/components';
import { createTestOverlayRef, provideTestOverlayRef } from './fake-overlay-ref';

type SaveResult = { saved: boolean };

@Component({ template: '' })
class EditOverlayComponent {
  public ref = EDIT_OVERLAY.injectRef();

  public save() {
    this.ref.close({ saved: true });
  }
}

const EDIT_OVERLAY = defineOverlay<EditOverlayComponent, SaveResult>({ component: EditOverlayComponent });

describe('createTestOverlayRef', () => {
  it('resolves definition.injectRef() and records the close result', async () => {
    const ref = createTestOverlayRef<SaveResult>();

    TestBed.configureTestingModule({ providers: [provideTestOverlayRef(ref)] });
    TestBed.createComponent(EditOverlayComponent).componentInstance.save();

    expect(ref.closeCalls).toEqual([{ result: { saved: true }, source: 'api', forced: false }]);
    expect(ref.isClosed()).toBe(true);
    expect(await firstValueFrom(ref.afterClosed())).toEqual({ saved: true });
  });

  it('runs close guards on close but not on forceClose', () => {
    const ref = createTestOverlayRef<SaveResult>();

    ref.registerCloseGuard(() => false);
    ref.close({ saved: false });

    expect(ref.isClosed()).toBe(false);

    ref.forceClose({ saved: false });

    expect(ref.isClosed()).toBe(true);
    expect(ref.closeCalls.map((call) => call.forced)).toEqual([false, true]);
  });
});
