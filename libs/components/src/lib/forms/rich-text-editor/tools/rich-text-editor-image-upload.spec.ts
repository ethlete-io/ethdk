import { ApplicationRef, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import '../../../../test-helpers';
import { AnyDropzoneUploadConfig, DropzoneUploadState } from '../../dropzone/headless';
import { startImageUpload } from './rich-text-editor-image-upload';

const FILE = new File(['x'], 'photo.png', { type: 'image/png' });

describe('startImageUpload', () => {
  let injector: Injector;
  let progress: (number | null)[];
  let successes: string[];
  let errors: { error: unknown; message: string | null }[];

  const flushEffects = () => TestBed.inject(ApplicationRef).tick();

  const callbacks = () => ({
    onProgress: (percentage: number | null) => progress.push(percentage),
    onSuccess: (url: string) => successes.push(url),
    onError: (error: unknown, message: string | null) => errors.push({ error, message }),
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
    progress = [];
    successes = [];
    errors = [];
  });

  it('resolves an upload function returning a promise', async () => {
    startImageUpload({ file: FILE, upload: () => Promise.resolve('https://cdn/a.png'), injector, ...callbacks() });

    await Promise.resolve();

    expect(successes).toEqual(['https://cdn/a.png']);
  });

  it('reports a rejected promise, with its message', async () => {
    startImageUpload({
      file: FILE,
      upload: () => Promise.reject(new Error('nope')),
      injector,
      ...callbacks(),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toEqual([{ error: new Error('nope'), message: 'nope' }]);
  });

  it('takes the first value of an upload observable', () => {
    startImageUpload({ file: FILE, upload: () => of('https://cdn/b.png'), injector, ...callbacks() });

    expect(successes).toEqual(['https://cdn/b.png']);
  });

  it('reports an observable error instead of letting it escape', () => {
    startImageUpload({
      file: FILE,
      upload: () => throwError(() => new Error('boom')),
      injector,
      ...callbacks(),
    });

    expect(errors).toEqual([{ error: new Error('boom'), message: 'boom' }]);
  });

  it('stops reporting once cancelled', () => {
    const work = new Subject<string>();
    const run = startImageUpload({ file: FILE, upload: () => work, injector, ...callbacks() });

    run.cancel();
    work.next('https://cdn/c.png');

    expect(successes).toEqual([]);
  });

  describe('with a dropzone upload config', () => {
    const createFakeConfig = () => {
      const state = signal<DropzoneUploadState>('uploading');
      const percentage = signal<number | null>(null);
      const value = signal<string | null>(null);
      const errorMessage = signal<string | null>(null);
      let executed = 0;
      let disposed = 0;

      const config: AnyDropzoneUploadConfig<string> = {
        selectValue: (response) => response as string,
        createUploadHandle: () => ({
          state,
          progress: percentage,
          error: signal(null),
          errorMessage,
          value,
          execute: () => executed++,
          dispose: () => disposed++,
        }),
      };

      return {
        config,
        state,
        percentage,
        value,
        errorMessage,
        executions: () => executed,
        disposals: () => disposed,
      };
    };

    it('executes the handle and mirrors its progress, then its value', () => {
      const fake = createFakeConfig();

      startImageUpload({ file: FILE, upload: fake.config, injector, ...callbacks() });

      expect(fake.executions()).toBe(1);

      fake.percentage.set(40);
      flushEffects();

      expect(progress).toContain(40);

      fake.value.set('https://cdn/d.png');
      fake.state.set('success');
      flushEffects();

      expect(successes).toEqual(['https://cdn/d.png']);
    });

    it('reports a failed handle with the message it resolved', () => {
      const fake = createFakeConfig();

      startImageUpload({ file: FILE, upload: fake.config, injector, ...callbacks() });

      fake.errorMessage.set('Too large');
      fake.state.set('error');
      flushEffects();

      expect(errors).toEqual([{ error: null, message: 'Too large' }]);
    });

    it('settles once - a later state change is no longer reported', () => {
      const fake = createFakeConfig();

      startImageUpload({ file: FILE, upload: fake.config, injector, ...callbacks() });

      fake.value.set('https://cdn/e.png');
      fake.state.set('success');
      flushEffects();

      fake.state.set('error');
      flushEffects();

      expect(successes).toEqual(['https://cdn/e.png']);
      expect(errors).toEqual([]);
    });

    it('disposes the handle when cancelled', () => {
      const fake = createFakeConfig();

      const run = startImageUpload({ file: FILE, upload: fake.config, injector, ...callbacks() });

      run.cancel();

      expect(fake.disposals()).toBe(1);
    });
  });
});
