import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, QueryButtonDirective } from '@ethlete/components';
import { createPostQuery, createQueryClient } from '@ethlete/query';

type PublishArgs = { response: { uuid: string }; body: FormData };

const client = createQueryClient({ baseUrl: 'https://dropzone.demo', name: 'queryButtonExample' });

const publish = createPostQuery(client)<PublishArgs>('/upload', { reportProgress: true });

@Component({
  selector: 'app-button-query-example',
  template: `
    <button [etQueryButton]="publishQuery" (click)="publishReport()" et-button type="button">Publish report</button>
    <p>Last upload: {{ publishQuery.response()?.uuid ?? 'none yet' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, QueryButtonDirective],
})
export class ButtonQueryExampleComponent {
  protected publishQuery = publish();

  protected publishReport() {
    this.publishQuery.execute({ args: { body: new FormData() } });
  }
}
