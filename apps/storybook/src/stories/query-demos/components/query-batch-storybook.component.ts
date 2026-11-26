import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { BUTTON_IMPORTS, ProgressBarComponent } from '@ethlete/components';
import { createPatchQuery, createQueryBatch } from '@ethlete/query';
import { queryDemoClient } from '../query-demo.utils';

type ArchivePostArgs = {
  pathParams: { id: number };
  body: { archived: boolean };
  response: { id: number; archived: boolean };
};

type Post = { id: number };

const archivePost = createPatchQuery(queryDemoClient)<ArchivePostArgs>((p) => `/posts/${p.id}`);

const POSTS: Post[] = Array.from({ length: 24 }, (_, i) => ({ id: i + 1 }));

@Component({
  selector: 'ethlete-sb-query-batch',
  template: `
    <div class="et-sb-batch-demo">
      <div class="et-sb-batch-demo-toolbar">
        <button
          [loading]="archive.running()"
          [progress]="archive.progress()"
          (click)="archiveAll()"
          et-button
          type="button"
          color="brand"
        >
          Archive {{ POSTS.length }} posts
        </button>
        <button [disabled]="!archive.running()" (click)="archive.cancel()" et-button type="button">cancel()</button>
        <button [disabled]="!archive.failed() || archive.running()" (click)="retry()" et-button type="button">
          retryFailed() - {{ archive.failed() }} failed
        </button>
      </div>

      <et-progress-bar [value]="archive.progress()" />

      <p class="et-sb-batch-demo-status">
        {{ archive.completed() }} / {{ archive.total() }} settled · {{ archive.inFlight() }} in flight ·
        <strong>{{ etaLabel() }}</strong>
      </p>

      <p class="et-sb-batch-demo-hint">
        The fake API answers each <code>PATCH</code> in 320-1120ms and rejects every 7th post, so the batch ends
        <code>partial</code> and <code>retryFailed()</code> has something to resend. The estimate needs the first
        <code>concurrency</code> items and 2s of run time before it appears - watch it settle as the run averages out.
      </p>

      <table class="et-sb-batch-demo-signals">
        <tbody>
          <tr>
            <td><code>status()</code></td>
            <td>
              <code>{{ archive.status() }}</code>
            </td>
          </tr>
          <tr>
            <td><code>itemsPerSecond()</code></td>
            <td>
              <code>{{ throughputLabel() }}</code>
            </td>
          </tr>
          <tr>
            <td><code>remainingTime()</code></td>
            <td>
              <code>{{ archive.remainingTime() ?? 'null' }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .et-sb-batch-demo {
      display: grid;
      gap: 12px;
      max-width: 640px;
      font-size: 14px;
    }

    .et-sb-batch-demo-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .et-sb-batch-demo-status {
      margin: 0;
    }

    .et-sb-batch-demo-hint {
      margin: 0;
      opacity: 0.75;
    }

    .et-sb-batch-demo-signals td {
      padding: 4px 8px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }

    .et-sb-batch-demo-signals td:first-child {
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, ProgressBarComponent],
})
export class QueryBatchStorybookComponent {
  private destroyRef = inject(DestroyRef);

  archive = createQueryBatch({
    queryCreator: archivePost,
    args: (post: Post) => ({ pathParams: { id: post.id }, body: { archived: true } }),
    concurrency: 4,
  });

  etaLabel = computed(() => {
    if (!this.archive.running()) return this.archive.status() === 'idle' ? 'not started' : 'done';

    const remaining = this.archive.remainingTime();

    if (remaining === null) return 'estimating…';

    const seconds = Math.ceil(remaining / 1000);

    return seconds >= 60 ? `about ${Math.ceil(seconds / 60)} min left` : `~${seconds}s left`;
  });

  throughputLabel = computed(() => {
    const rate = this.archive.itemsPerSecond();

    return rate === null ? 'null' : `${rate.toFixed(2)} items/s`;
  });

  readonly POSTS = POSTS;

  archiveAll() {
    this.archive.reset();
    this.archive.run(POSTS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  retry() {
    this.archive.retryFailed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
