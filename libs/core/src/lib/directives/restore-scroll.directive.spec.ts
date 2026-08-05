import { provideLocationMocks } from '@angular/common/testing';
import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterLink, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { setupScrollRestoration } from '../signals';
import { RestoreScrollDirective } from './restore-scroll.directive';

@Component({ selector: 'et-list-page', template: 'list' })
class ListPage {}

@Component({
  selector: 'et-detail-page',
  imports: [RouterLink, RestoreScrollDirective],
  template: `
    <a routerLink="/list" etRestoreScroll>marked</a>
    <a routerLink="/list">plain</a>
  `,
})
class DetailPage {}

/** jsdom has no layout, so the geometry restoration reads has to be backed by a plain object. */
const createScrollElement = (clientHeight = 500) => {
  const el = { scrollTop: 0, scrollHeight: 0, clientHeight };

  return {
    el: el as unknown as HTMLElement,
    setContentHeight: (height: number) => (el.scrollHeight = height),
    get scrollTop() {
      return el.scrollTop;
    },
    set scrollTop(value: number) {
      el.scrollTop = value;
    },
  };
};

const ROUTES: Routes = [
  { path: 'list', component: ListPage },
  { path: 'detail', component: DetailPage },
];

const settle = async (ms = 60) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

describe('RestoreScrollDirective', () => {
  const setup = async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(ROUTES), provideLocationMocks()] });

    const harness = await RouterTestingHarness.create();
    const scroller = createScrollElement();

    runInInjectionContext(TestBed.inject(Injector), () =>
      setupScrollRestoration({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 100 } }),
    );

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.setContentHeight(600);
    scroller.scrollTop = 0;

    const links = harness.routeNativeElement?.querySelectorAll('a') ?? [];

    return { harness, scroller, marked: links[0] as HTMLAnchorElement, plain: links[1] as HTMLAnchorElement };
  };

  it('restores the offset of the page a marked link returns to', async () => {
    const { scroller, marked } = await setup();

    marked.click();
    await settle();
    scroller.setContentHeight(4000);
    await settle();

    expect(scroller.scrollTop).toBe(1200);
  });

  it('leaves an unmarked link on the same page scrolling to top', async () => {
    const { scroller, plain } = await setup();

    plain.click();
    await settle();
    scroller.setContentHeight(4000);
    await settle(200);

    expect(scroller.scrollTop).toBe(0);
  });
});
