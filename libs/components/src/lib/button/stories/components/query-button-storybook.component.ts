import { booleanAttribute, Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { createPostQuery, createQueryClient } from '@ethlete/query';
import { MOCK_UPLOAD_BASE_URL } from '../../../forms/dropzone/stories/upload-mock';
import { BUTTON_IMPORTS } from '../../button.imports';
import { QueryButtonDirective } from '../../headless';

type PublishArgs = { response: { uuid: string }; body: FormData };

const client = createQueryClient({ baseUrl: MOCK_UPLOAD_BASE_URL, name: 'queryButtonDemo' });

const publish = createPostQuery(client)<PublishArgs>('/upload', { reportProgress: true });

@Component({
  selector: 'et-sb-query-button',
  template: `
    <div [etProvideColor]="color()" class="flex flex-col items-start gap-4 p-8 font-sans">
      <button [etQueryButton]="publishQuery" [showProgress]="showProgress()" (click)="publishReport()" et-button>
        Publish report
      </button>
      <p class="text-small opacity-60">Last upload: {{ publishQuery.response()?.uuid ?? 'none yet' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, QueryButtonDirective, ProvideColorDirective],
})
export class QueryButtonStorybookComponent {
  public color = input('brand');
  public showProgress = input(true, { transform: booleanAttribute });

  protected publishQuery = publish();

  protected publishReport() {
    this.publishQuery.execute({ args: { body: new FormData() } });
  }
}
