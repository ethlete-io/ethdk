import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { QueryButtonComponent } from '@ethlete/cdk';
import { V2QueryClient, def } from '@ethlete/query';

const client = new V2QueryClient({ baseRoute: 'https://dropzone.demo' });

const publish = client.post({
  route: '/upload',
  types: { args: def<{ body: FormData }>(), response: def<{ uuid: string }>() },
});

@Component({
  selector: 'app-cdk-query-button-example',
  template: ` <button [query]="publish$ | async" (click)="save()" et-query-button type="button">Save</button> `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryButtonComponent, AsyncPipe],
})
export class CdkQueryButtonExampleComponent {
  public publish$ = publish.createSubject();

  public save() {
    this.publish$.next(publish.prepare({ body: new FormData() }).execute({ skipCache: true }));
  }
}
