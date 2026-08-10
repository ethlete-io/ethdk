import { Component, ViewEncapsulation, signal } from '@angular/core';
import { copyToClipboard } from '@ethlete/core';
import { queryDevtoolsAbout } from '@ethlete/query';
import { tap } from 'rxjs';

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

  protected copy() {
    const text = this.groups
      .map((group) => [group.title, ...group.rows.map((row) => `  ${row.label}: ${row.value}`)].join('\n'))
      .join('\n\n');

    copyToClipboard(text)
      .pipe(tap((ok) => this.copied.set(ok)))
      .subscribe();
  }
}
