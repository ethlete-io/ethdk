import { Component, computed, input, linkedSignal, output, signal, ViewEncapsulation } from '@angular/core';
import { applyQueryDevtoolsOverrides, createQueryDevtoolsOverrides } from '@ethlete/query';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** Which editor the designed body is being changed through. */
type DesignerMode = 'design' | 'json';

/**
 * The body editor of a designed mock: the value explorer's per-node override menu - presets,
 * fill-recursively, duplicate, pagination resize, paste, delete - pointed at a draft instead of at a live
 * response, so the same vocabulary that tampers with real data authors fake data.
 *
 * Edits accumulate as override ops and are flattened into a plain body on save, which is what makes
 * "undo all" free and keeps the stored mock a value rather than a recipe.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-mock-designer',
  templateUrl: './query-devtools-mock-designer.component.html',
  styleUrl: './query-devtools-mock-designer.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsMockDesignerComponent {
  /** The body the session starts from. Changing it restarts the session, dropping any unsaved edits. */
  public body = input<unknown>();

  /** The declared type of each field, as a seed from the API description produces it. */
  public annotations = input<ReadonlyMap<string, string> | null>(null);

  /** What the description had to guess or could not read, shown under the body it seeded. */
  public notes = input<readonly string[]>([]);

  public save = output<unknown>();
  public dismiss = output<void>();

  /** A fresh recorder per body, so reopening the designer never replays the last session's ops. */
  protected recorder = linkedSignal<unknown, ReturnType<typeof createQueryDevtoolsOverrides>>({
    source: () => this.body(),
    computation: () => createQueryDevtoolsOverrides(),
  });

  protected mode = signal<DesignerMode>('design');
  protected jsonError = signal<string | null>(null);

  protected editCount = computed(() => this.recorder().list().length);

  /** The body as it now reads: every armed op replayed against the one the session started from. */
  protected designed = computed(() => applyQueryDevtoolsOverrides(this.recorder().list(), this.body()).value);

  /** The raw editor's text, re-seeded from the designed body whenever that changes underneath it. */
  protected jsonDraft = linkedSignal(() => safeStringify(this.designed()));

  protected undoAll() {
    this.recorder().clearAll();
    this.jsonError.set(null);
  }

  /**
   * Leaving the raw editor carries whatever was typed there into the tree as one root-level edit, so the
   * two editors are two views of one draft rather than two drafts.
   */
  protected showDesign() {
    const text = this.jsonDraft();

    if (text !== safeStringify(this.designed())) {
      let value: unknown;

      try {
        value = JSON.parse(text || 'null');
      } catch (error) {
        this.jsonError.set(error instanceof Error ? error.message : String(error));

        return;
      }

      this.recorder().arm({ type: 'set', path: [], value });
    }

    this.mode.set('design');
    this.jsonError.set(null);
  }

  protected showJson() {
    this.mode.set('json');
    this.jsonError.set(null);
  }

  protected apply() {
    if (this.mode() === 'design') {
      this.save.emit(this.designed());

      return;
    }

    try {
      this.save.emit(JSON.parse(this.jsonDraft() || 'null'));
    } catch (error) {
      this.jsonError.set(error instanceof Error ? error.message : String(error));
    }
  }
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return 'null';
  }
};
