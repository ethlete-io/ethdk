import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject, Injector, signal, Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { createPostQuery, createQueryClient } from '@ethlete/query';
import {
  createDropzoneUpload,
  createExistingDropzoneEntry,
  createFileDropzoneEntry,
  disposeDropzoneEntry,
  DROPZONE_ENTRY_STATUSES,
  DROPZONE_ERROR_CODES,
  DropzoneDirective,
  DropzoneEntry,
  isFileAccepted,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const AVATAR_TYPES = '.png,image/jpeg';

const file = (name: string, type: string) => new File([new Uint8Array(512)], name, { type });

const avatarUpload = () => {
  const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'dropzone-headless-scenario' });

  return createDropzoneUpload({
    queryCreator: createPostQuery(client)<{ body: FormData; response: { key: string } }>('/avatars'),
    selectValue: (response) => response.key,
    resolveExisting: (key: string) => ({ name: `${key}.png`, size: 2048 }),
  });
};

@Component({
  selector: 'et-scenario-avatar-picker',
  imports: [DropzoneDirective],
  template: `
    <div
      #avatarZone="etDropzone"
      [(value)]="avatars"
      [upload]="upload"
      (filesReject)="rejected = $event.length"
      etDropzone
      multiple
    >
      <p class="avatar-count">{{ avatarZone.entries().length }} files</p>
      @for (entry of avatarZone.entries(); track entry.id) {
        <span [attr.data-status]="entry.status()" class="avatar-entry">{{ entry.name() }}</span>
      }
    </div>
    <p class="avatar-history">{{ historyNames() }}</p>
  `,
})
class AvatarPickerComponent {
  private injector = inject(Injector);

  upload = avatarUpload();
  avatars = signal<string[]>(['default']);
  rejected = 0;
  zone = viewChild.required(DropzoneDirective);
  history = signal<DropzoneEntry<string>[]>([]);
  historyNames = () =>
    this.history()
      .map((entry) => `${entry.name()} (${entry.status()})`)
      .join(', ');

  pasteFiles(files: File[]) {
    this.zone().selectFiles(files.filter((pasted) => isFileAccepted(pasted, AVATAR_TYPES)));
  }

  restore(keys: string[]) {
    this.history.set(keys.map((key) => createExistingDropzoneEntry({ value: key, upload: signal(this.upload) })));
  }

  uploadOutside(picked: File) {
    const handle = this.upload.createUploadHandle({ file: picked, injector: this.injector });
    const entry = createFileDropzoneEntry({ file: picked, handle });

    handle.execute();
    this.history.update((entries) => [...entries, entry]);

    return entry;
  }

  forget(entry: DropzoneEntry<string>) {
    disposeDropzoneEntry(entry);
    this.history.update((entries) => entries.filter((candidate) => candidate !== entry));
  }
}

@Component({
  selector: 'et-scenario-broken-upload',
  imports: [DropzoneDirective],
  template: '<div [upload]="upload" etDropzone></div>',
})
class BrokenUploadComponent {
  upload = {} as ReturnType<typeof avatarUpload>;
}

@Component({
  selector: 'et-scenario-unresolved-value',
  imports: [DropzoneDirective],
  template: '<div [value]="value" [upload]="upload" etDropzone></div>',
})
class UnresolvedValueComponent {
  value = 'legacy-key';
  upload = createDropzoneUpload({
    queryCreator: createPostQuery(createQueryClient({ baseUrl: 'https://api.example.com', name: 'unresolved' }))<{
      body: FormData;
      response: { key: string };
    }>('/avatars'),
    selectValue: (response) => response.key,
  });
}

@Component({
  selector: 'et-scenario-mode-mismatch',
  imports: [DropzoneDirective],
  template: '<div [value]="value" [upload]="upload" etDropzone></div>',
})
class ModeMismatchComponent {
  value = ['a', 'b'];
  upload = avatarUpload();
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('forms dropzone headless scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemes(TEST_COLOR_THEMES), provideHttpClient(), provideHttpClientTesting()],
  });

  it('drives a custom dropzone through the directive and builds entries outside of it', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AvatarPickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    expect(text(query('.avatar-count', host))).toBe('1 files');
    expect(queryAll('.avatar-entry', host).map((entry) => [text(entry), entry.getAttribute('data-status')])).toEqual([
      ['default.png', DROPZONE_ENTRY_STATUSES.EXISTING],
    ]);

    app.pasteFiles([file('me.png', 'image/png'), file('me.gif', 'image/gif'), file('me.jpg', 'image/jpeg')]);
    s.tick();

    expect(isFileAccepted(file('me.gif', 'image/gif'), 'image/*')).toBe(true);
    expect(queryAll('.avatar-entry', host).map(text)).toEqual(['default.png', 'me.png', 'me.jpg']);
    expect(app.zone().anyUploading()).toBe(true);

    const [first, second] = http.match('https://api.example.com/avatars');

    first?.flush({ key: 'k-png' });
    second?.flush({ message: 'Too big' }, { status: 413, statusText: 'Payload Too Large' });
    s.tick();
    s.errors.splice(0);

    expect(app.avatars()).toEqual(['default', 'k-png']);
    expect(app.zone().anyFailed()).toBe(true);
    expect(app.zone().entries()[2]?.errorMessage()).toBe('Too big');

    const failed = app.zone().entries()[2];

    app.zone().retryEntry(failed?.id ?? '');
    http.expectOne('https://api.example.com/avatars').flush({ key: 'k-jpg' });
    s.tick();
    expect(app.avatars()).toEqual(['default', 'k-png', 'k-jpg']);

    app.zone().removeEntry(app.zone().entries()[0]?.id ?? '');
    s.tick();
    expect(app.avatars()).toEqual(['k-png', 'k-jpg']);

    app.restore(['old-1', 'old-2']);
    s.tick();
    expect(text(query('.avatar-history', host))).toBe('old-1.png (existing), old-2.png (existing)');

    const outside = app.uploadOutside(file('team.png', 'image/png'));

    s.tick();
    expect(outside.size()).toBe(512);
    expect(text(query('.avatar-history', host))).toContain('team.png (uploading)');

    const pending = http.expectOne('https://api.example.com/avatars');

    app.forget(outside);
    s.tick();
    expect(pending.cancelled).toBe(true);
    expect(text(query('.avatar-history', host))).toBe('old-1.png (existing), old-2.png (existing)');

    app.zone().clear();
    s.tick();
    expect(app.avatars()).toEqual([]);
    expect(app.rejected).toBe(0);
    http.verify();
  });

  it('reports a runtime error for an upload config not built by createDropzoneUpload', () => {
    const s = scenario();

    TestBed.createComponent(BrokenUploadComponent);
    s.tick();
    s.flush();

    takeRuntimeError(s, DROPZONE_ERROR_CODES.INVALID_UPLOAD_CONFIG);
  });

  it.each([
    [
      'an initial value without resolveExisting',
      UnresolvedValueComponent,
      DROPZONE_ERROR_CODES.MISSING_EXISTING_RESOLVER,
    ],
    ['an array value in single mode', ModeMismatchComponent, DROPZONE_ERROR_CODES.VALUE_MODE_MISMATCH],
  ])('reports a runtime error for %s', (_label, component, code) => {
    const s = scenario();

    expect(() => {
      TestBed.createComponent(component as Type<unknown>);
      s.tick();
    }).toThrow(`ET${code}`);
    s.flush();
    expect(s.errors.splice(0).map((entry) => entry.source)).toEqual(['console.error']);
  });
});
