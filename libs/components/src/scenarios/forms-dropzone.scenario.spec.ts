import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  createDeleteQuery,
  createPostQuery,
  createQueryClient,
  def,
  RequestError,
  V2QueryClient,
} from '@ethlete/query';
import {
  createDefaultDropzoneArgs,
  createDropzoneUpload,
  createV2DropzoneUpload,
  DEFAULT_DROPZONE_LABELS,
  defaultDropzoneRejectionMessage,
  DROPZONE_ENTRY_STATUSES,
  DROPZONE_FILE_CONSTRAINTS,
  DROPZONE_FILE_REJECTION_REASONS,
  DROPZONE_FILES_ERROR_KIND,
  DROPZONE_LABELS,
  DropzoneComponent,
  DropzoneFileConstraints,
  DropzoneFileRejection,
  dropzoneFiles,
  formatFileSize,
  HintComponent,
  injectDropzoneLabels,
  LabelDirective,
  provideDropzoneLabels,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

const CONTRACT_CONSTRAINTS: DropzoneFileConstraints = {
  accept: '.pdf,application/pdf',
  maxFileSize: 2 * 1024 * 1024,
  minFileSize: 10,
};

const file = (name: string, size = 2048, type = name.endsWith('.pdf') ? 'application/pdf' : 'text/plain') =>
  new File([new Uint8Array(size)], name, { type });

const brokenUpload: RequestError = {
  url: 'https://api.example.com/photos',
  status: 500,
  statusText: 'Server Error',
  detail: { message: 'Storage full' },
  httpErrorResponse: null as never,
};

@Component({
  selector: 'et-scenario-contract-upload',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [DropzoneComponent, LabelDirective, HintComponent, FormField],
  template: `
    <et-dropzone
      [formField]="contractForm.contract"
      [upload]="upload"
      (touch)="touches = touches + 1"
      (filesReject)="rejections.push($event)"
      (uploadSucceed)="uploaded.push($event.name())"
      (deleteSucceed)="deleted.push($event)"
    >
      <et-label>Contract</et-label>
      <et-hint>PDF, up to {{ maxSize() }}</et-hint>
    </et-dropzone>
  `,
})
class ContractUploadComponent {
  private client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'dropzone-scenario' });

  upload = createDropzoneUpload({
    queryCreator: createPostQuery(this.client)<{
      body: FormData;
      queryParams: { folder: string };
      response: { id: string };
    }>('/documents'),
    createArgs: (picked) => ({
      body: createDefaultDropzoneArgs(picked).body,
      queryParams: { folder: 'contracts' },
    }),
    selectValue: (response) => response.id,
    delete: {
      queryCreator: createDeleteQuery(this.client)<{ pathParams: { id: string }; response: null }>(
        (params) => `/documents/${params.id}`,
      ),
      createArgs: (id: string) => ({ pathParams: { id } }),
    },
  });

  model = signal<{ contract: string | null }>({ contract: null });
  contractForm = form(this.model, (path) => {
    required(path.contract, { message: 'Upload the contract' });
    dropzoneFiles(path.contract, CONTRACT_CONSTRAINTS);
  });
  maxSize = computed(() =>
    formatFileSize(this.contractForm.contract().metadata(DROPZONE_FILE_CONSTRAINTS)?.constraints()?.maxFileSize ?? 0),
  );
  touches = 0;
  rejections: DropzoneFileRejection[][] = [];
  uploaded: string[] = [];
  deleted: string[] = [];
}

@Component({
  selector: 'et-scenario-gallery-upload',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [DropzoneComponent, LabelDirective, ReactiveFormsModule],
  providers: [provideDropzoneLabels({ retry: 'Erneut', remove: 'Entfernen' })],
  template: `
    <et-dropzone [formControl]="control" [upload]="upload" (uploadFail)="failures = failures + 1" multiple>
      <et-label>Gallery</et-label>
    </et-dropzone>
  `,
})
class GalleryUploadComponent {
  upload = createV2DropzoneUpload({
    queryCreator: new V2QueryClient({ baseRoute: 'https://api.example.com' }).post({
      route: '/photos',
      types: { args: def<{ body: FormData }>(), response: def<{ uuid: string }>() },
    }),
    createArgs: (picked) => ({
      body: createDefaultDropzoneArgs(picked).body,
      mock: picked.name.startsWith('broken')
        ? { delay: 5, error: brokenUpload }
        : { delay: 5, response: { uuid: `photo-${picked.name}` } },
    }),
    selectValue: (response) => response.uuid,
    resolveExisting: (value: string) => ({
      name: `${value}.jpg`,
      size: 1536,
      previewUrl: `https://cdn.example.com/${value}.jpg`,
    }),
  });

  control = new FormControl<string[]>(['cover'], { nonNullable: true });
  failures = 0;
  labels = injectDropzoneLabels();
}

@Component({
  selector: 'et-scenario-archive-view',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [DropzoneComponent],
  providers: [{ provide: DROPZONE_LABELS, useValue: (locale: string) => ({ prompt: `Ablegen (${locale})` }) }],
  template: ` <et-dropzone [(value)]="archive" [upload]="upload" [readonly]="readonly()" aria-label="Archive" /> `,
})
class ArchiveViewComponent {
  upload = createV2DropzoneUpload({
    queryCreator: new V2QueryClient({ baseRoute: 'https://api.example.com' }).post({
      route: '/archive',
      types: { args: def<{ body: FormData }>(), response: def<{ uuid: string }>() },
    }),
    selectValue: (response) => response.uuid,
  });

  archive = signal<string | null>(null);
  readonly = signal(true);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const dragEvent = (type: string, files: File[], types = ['Files']) => {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', { value: { types, files } });

  return event;
};

const drop = (s: Scenario, target: HTMLElement, files: File[]) => {
  target.dispatchEvent(dragEvent('dragenter', files));
  target.dispatchEvent(dragEvent('dragover', files));
  target.dispatchEvent(dragEvent('drop', files));
  s.tick();
};

const pick = (s: Scenario, host: HTMLElement, files: File[]) => {
  const input = query<HTMLInputElement>('.et-dropzone-native-input', host);

  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
  s.tick();
};

const microtasks = async () => {
  for (let round = 0; round < 5; round++) await Promise.resolve();
};

describe('forms dropzone scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemes(TEST_COLOR_THEMES), provideHttpClient(), provideHttpClientTesting()],
  });

  it('validates dropped files against the signal form rule, uploads, replaces and deletes', async () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ContractUploadComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;
    const zone = query('et-dropzone', host);

    s.tick();

    const trigger = query<HTMLButtonElement>('.et-dropzone-trigger', host);

    expect(trigger.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);
    expect(text(query('.et-dropzone-prompt', host))).toBe(DEFAULT_DROPZONE_LABELS.prompt);
    expect(text(query('et-hint', host))).toBe('PDF, up to 2 MB');
    expect(query<HTMLInputElement>('.et-dropzone-native-input', host).accept).toBe(CONTRACT_CONSTRAINTS.accept);

    trigger.focus();
    trigger.blur();
    s.tick();
    expect(app.touches).toBe(1);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(text(query('.et-form-support-errors', host))).toBe('Upload the contract');

    zone.dispatchEvent(dragEvent('dragenter', [], ['text/plain']));
    s.tick();
    expect(zone.hasAttribute('data-drag-over')).toBe(false);
    zone.dispatchEvent(dragEvent('dragenter', []));
    s.tick();
    expect(zone.hasAttribute('data-drag-over')).toBe(true);
    zone.dispatchEvent(dragEvent('dragleave', []));
    s.tick();
    expect(zone.hasAttribute('data-drag-over')).toBe(false);

    const notes = file('notes.txt');

    drop(s, zone, [notes]);
    expect(app.rejections.at(-1)).toEqual([{ file: notes, reason: DROPZONE_FILE_REJECTION_REASONS.ACCEPT }]);
    expect(
      app.contractForm
        .contract()
        .errors()
        .map((error) => [error.kind, error.message]),
    ).toEqual([
      ['required', 'Upload the contract'],
      [
        DROPZONE_FILES_ERROR_KIND,
        defaultDropzoneRejectionMessage(app.rejections[0]?.[0] ?? { file: notes, reason: 'accept' }, undefined),
      ],
    ]);
    expect(zone.hasAttribute('data-drag-over')).toBe(false);

    drop(s, zone, [file('scan.pdf', 3 * 1024 * 1024)]);
    expect(text(query('.et-form-support-errors', host))).toContain('"scan.pdf" is too large (max 2 MB).');

    drop(s, zone, [file('stub.pdf', 2)]);
    expect(text(query('.et-form-support-errors', host))).toContain('"stub.pdf" is too small (min 10 B).');
    http.expectNone(() => true);

    drop(s, zone, [file('contract.pdf'), file('annex.pdf')]);
    expect(app.rejections.at(-1)?.map((rejection) => [rejection.file.name, rejection.reason])).toEqual([
      ['annex.pdf', DROPZONE_FILE_REJECTION_REASONS.MAX_FILES],
    ]);
    expect(text(query('.et-form-support-errors', host))).toContain('"annex.pdf" was not added');
    expect(query('.et-dropzone-preview', host).getAttribute('data-status')).toBe(DROPZONE_ENTRY_STATUSES.UPLOADING);
    expect(text(query('.et-dropzone-preview .et-dropzone-entry-name', host))).toBe('contract.pdf');
    expect(text(query('.et-dropzone-entry-size', host))).toBe('2 KB');
    expect(text(query('.et-dropzone-live-status', host))).toBe('Uploading 1 file');

    const request = http.expectOne((candidate) => candidate.method === 'POST');

    expect(request.request.urlWithParams).toBe('https://api.example.com/documents?folder=contracts');
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    request.flush({ id: 'doc-1' });
    s.tick();

    expect(app.model().contract).toBe('doc-1');
    expect(app.uploaded).toEqual(['contract.pdf']);
    expect(query('.et-dropzone-preview', host).getAttribute('data-status')).toBe(DROPZONE_ENTRY_STATUSES.SUCCESS);
    expect(text(query('.et-dropzone-live-status', host))).toBe('');

    drop(s, zone, [file('contract-signed.pdf')]);
    expect(
      app.contractForm
        .contract()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['required']);
    http.expectOne((candidate) => candidate.method === 'POST').flush({ id: 'doc-2' });
    http.expectOne('https://api.example.com/documents/doc-1').flush(null);
    s.tick();
    await microtasks();

    expect(app.model().contract).toBe('doc-2');
    expect(app.deleted).toEqual(['doc-1']);
    expect(query('.et-dropzone-replace-button', host).getAttribute('aria-label')).toBe(
      DEFAULT_DROPZONE_LABELS.replaceFile,
    );

    const remove = query<HTMLButtonElement>('.et-dropzone-remove-button', host);

    expect(remove.getAttribute('aria-label')).toBe('Remove contract-signed.pdf');
    remove.click();
    s.tick();
    s.frame(20);
    s.tick(500);
    http.expectOne('https://api.example.com/documents/doc-2').flush(null);
    s.tick();
    await microtasks();

    expect(app.model().contract).toBeNull();
    expect(app.deleted).toEqual(['doc-1', 'doc-2']);
    expect(document.querySelector('.et-dropzone-preview')).toBeNull();
    http.verify();
  });

  it('lets an in-flight delete request finish quietly when the dropzone is destroyed', async () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ContractUploadComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    drop(s, query('et-dropzone', host), [file('contract.pdf')]);
    http.expectOne((candidate) => candidate.method === 'POST').flush({ id: 'doc-1' });
    s.tick();

    query<HTMLButtonElement>('.et-dropzone-remove-button', host).click();
    s.tick();
    s.frame(20);
    s.tick(500);
    const deleteRequest = http.expectOne('https://api.example.com/documents/doc-1');

    fixture.destroy();
    s.tick();

    expect(deleteRequest.cancelled).toBe(false);

    deleteRequest.flush(null);
    s.tick();
    await microtasks();

    expect(app.deleted).toEqual([]);
    expect(s.warnings.map((entry) => String(entry.warning))).toEqual([]);
  });

  it('shows existing values, uploads picked files and retries a failed one in a multi dropzone', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GalleryUploadComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;
    const control = app.control;

    s.tick();

    expect(app.labels().retry).toBe('Erneut');
    expect(app.labels().prompt).toBe(DEFAULT_DROPZONE_LABELS.prompt);
    expect(query<HTMLInputElement>('.et-dropzone-native-input', host).multiple).toBe(true);
    expect(query('.et-dropzone-list', host).getAttribute('role')).toBe('list');
    expect(queryAll('et-dropzone-item', host).map((item) => item.getAttribute('data-status'))).toEqual([
      DROPZONE_ENTRY_STATUSES.EXISTING,
    ]);
    expect(text(query('et-dropzone-item .et-dropzone-entry-name', host))).toBe('cover.jpg');
    expect(text(query('et-dropzone-item .et-dropzone-entry-size', host))).toBe('1.5 KB');
    expect(query<HTMLImageElement>('et-dropzone-item img', host).src).toBe('https://cdn.example.com/cover.jpg');

    pick(s, host, [file('beach.txt'), file('broken.txt')]);
    expect(text(query('.et-dropzone-live-status', host))).toBe('Uploading 2 files');
    expect(query<HTMLInputElement>('.et-dropzone-native-input', host).value).toBe('');

    s.tick(10);
    s.tick(10);

    expect(control.value).toEqual(['cover', 'photo-beach.txt']);
    expect(queryAll('et-dropzone-item', host).map((item) => item.getAttribute('data-status'))).toEqual([
      DROPZONE_ENTRY_STATUSES.EXISTING,
      DROPZONE_ENTRY_STATUSES.SUCCESS,
      DROPZONE_ENTRY_STATUSES.ERROR,
    ]);
    expect(app.failures).toBe(1);
    expect(query('.et-dropzone-internal-errors', host).getAttribute('role')).toBe('alert');
    expect(text(query('.et-dropzone-internal-errors', host))).toBe('"broken.txt": Storage full');

    const retry = query<HTMLButtonElement>('.et-dropzone-retry-button', host);

    expect(retry.getAttribute('aria-label')).toBe('Erneut broken.txt');
    retry.click();
    s.tick();
    expect(queryAll('et-dropzone-item', host)[2]?.getAttribute('data-status')).toBe(DROPZONE_ENTRY_STATUSES.UPLOADING);
    s.tick(10);
    s.tick(10);
    expect(app.failures).toBe(2);

    const removeCover = queryAll<HTMLButtonElement>('.et-dropzone-remove-button', host)[0];

    expect(removeCover?.getAttribute('aria-label')).toBe('Entfernen cover.jpg');
    removeCover?.click();
    s.tick();
    s.frame(20);
    s.tick(500);
    expect(control.value).toEqual(['photo-beach.txt']);
    expect(control.touched).toBe(true);

    control.setValue(['cover', 'photo-beach.txt']);
    s.tick();
    expect(queryAll('et-dropzone-item .et-dropzone-entry-name', host).map(text)).toEqual([
      'cover.jpg',
      'beach.txt',
      'broken.txt',
    ]);

    control.disable();
    s.tick();
    expect(query<HTMLButtonElement>('.et-dropzone-trigger', host).disabled).toBe(true);
    s.frame(5);
  });

  it('renders the readonly empty state and a per-locale prompt from the DROPZONE_LABELS token', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ArchiveViewComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const trigger = query<HTMLButtonElement>('.et-dropzone-trigger', host);

    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('aria-label')).toBe('Archive');
    expect(text(query('.et-dropzone-empty', host))).toBe(DEFAULT_DROPZONE_LABELS.empty);

    fixture.componentInstance.readonly.set(false);
    s.tick();
    expect(host.querySelector('.et-dropzone-empty')).toBeNull();
    expect(text(query('.et-dropzone-prompt', host))).toMatch(/^Ablegen \(.+\)$/);
    s.frame(5);
  });
});
