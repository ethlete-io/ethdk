import { Component, ViewEncapsulation, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { copyToClipboard } from '@ethlete/core';
import { queryDevtoolsAbout } from '@ethlete/query';
import { Subject, switchMap, tap, timer } from 'rxjs';
import { QUERY_DEVTOOLS_COPIED_RESET_MS } from './query-devtools-types';

type AboutRow = { label: string; value: string };
type AboutGroup = { title: string; rows: AboutRow[] };

const groupsOf = (): AboutGroup[] => {
  const about = queryDevtoolsAbout();

  const groups: AboutGroup[] = [
    {
      title: 'Ethlete',
      rows: Object.entries(about.ethlete).map(([name, version]) => ({ label: `@ethlete/${name}`, value: version })),
    },
    { title: 'Runtime', rows: [{ label: 'Angular', value: about.angular }] },
  ];

  if (about.app) {
    groups.push({
      title: 'Application',
      rows: Object.entries(about.app).map(([label, value]) => ({ label, value: String(value) })),
    });
  }

  return groups;
};

/**
 * What is running: the loaded `@ethlete/*` versions, the Angular version and whatever the app handed to
 * `provideQueryDevtools({ about })`. A section rather than a tab body, so it can be shown anywhere.
 */
@Component({
  selector: 'et-query-devtools-about',
  templateUrl: './query-devtools-about.component.html',
  styleUrl: './query-devtools-about.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsAboutComponent {
  protected readonly groups = groupsOf();

  protected copied = signal(false);
  private copiedReset$ = new Subject<void>();

  constructor() {
    // Each copy restarts the tick countdown; switchMap drops the pending reset of the previous one.
    this.copiedReset$
      .pipe(
        switchMap(() => timer(QUERY_DEVTOOLS_COPIED_RESET_MS)),
        tap(() => this.copied.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected copy() {
    const text = this.groups
      .map((group) => [group.title, ...group.rows.map((row) => `  ${row.label}: ${row.value}`)].join('\n'))
      .join('\n\n');

    copyToClipboard(text)
      .pipe(
        tap((ok) => {
          this.copied.set(ok);
          this.copiedReset$.next();
        }),
      )
      .subscribe();
  }
}
