import { Component, ErrorHandler, input, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from './grid-item.component';
import { GridComponent } from './grid.component';
import { provideGridConfig } from './headless/grid-config';
import { GridDirective } from './headless/grid.directive';
import { GridItemConfig, GridSerializedState } from './headless/grid.types';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  private targets = new Set<Element>();

  constructor(private callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  emit() {
    const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry);
    if (entries.length > 0) {
      this.callback(entries, this as unknown as ResizeObserver);
    }
  }
}

@Component({
  template: '',
})
class TestItemComponent {
  data = input<unknown>();
}

@Component({
  imports: [GridComponent],
  template: ` <et-grid [rowHeight]="rowHeight" [gap]="gap" [items]="items" /> `,
})
class TestHostComponent {
  rowHeight = 120;
  gap = 8;
  items: GridItemConfig[] = [];
}

@Component({
  imports: [GridComponent, GridItemComponent],
  template: `
    <et-grid [items]="items">
      @for (item of projected; track item.id) {
        <et-grid-item [itemId]="item.id">{{ item.id }}</et-grid-item>
      }
    </et-grid>
  `,
})
class ProjectedHostComponent {
  items: GridItemConfig[] = [
    {
      id: 'a',
      type: 'unregistered',
      data: undefined,
      layout: {
        lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    },
  ];

  projected = this.items;
}

@Component({
  imports: [GridComponent, GridItemComponent],
  template: `
    <et-grid [items]="items">
      @for (item of items; track item.id) {
        <et-grid-item [itemId]="item.id">{{ item.id }}</et-grid-item>
      }
    </et-grid>
  `,
})
class DoubleRenderedHostComponent {
  items: GridItemConfig[] = [
    {
      id: 'a',
      type: 'test',
      data: undefined,
      layout: {
        lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    },
  ];
}

type WidgetData = { title: string };

@Component({
  imports: [GridComponent],
  template: ` <et-grid [items]="items" (layoutChange)="states.push($event)" /> `,
})
class TypedHostComponent {
  // The type argument is never written down: `layoutChange` only type-checks against a
  // `GridSerializedState<WidgetData>[]` because the component inferred `TData` from these items.
  items: GridItemConfig<string, WidgetData>[] = [
    {
      id: 'a',
      type: 'test',
      data: { title: 'Widget A' },
      layout: {
        lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    },
  ];

  states: GridSerializedState<WidgetData>[] = [];
}

describe('GridComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getGrid = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

  const measureGrid = (width = 1216) => {
    const gridEl = fixture.debugElement.query(By.directive(GridDirective)).nativeElement as HTMLElement;
    Object.defineProperty(gridEl, 'clientWidth', { configurable: true, value: width });
    TestBed.tick();
    ResizeObserverMock.instances.forEach((instance) => instance.emit());
    fixture.detectChanges();
  };

  beforeEach(() => {
    originalResizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    ResizeObserverMock.instances = [];

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    });

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [...provideGridConfig({ registrations: [{ type: 'test', component: TestItemComponent }] })],
    });
    fixture = TestBed.createComponent(TestHostComponent);
  });

  afterEach(() => {
    if (originalResizeObserverDescriptor) {
      Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserverDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).ResizeObserver;
    }
  });

  it('renders the grid host element with class et-grid', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.et-grid')).not.toBeNull();
  });

  it('has role="region" on the grid element', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector('.et-grid') as HTMLElement;
    expect(grid.getAttribute('role')).toBe('region');
  });

  it('starts with no items in the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().currentItems()).toHaveLength(0);
  });

  it('starts with null drag state', () => {
    fixture.detectChanges();
    expect(getGrid().dragState()).toBeNull();
  });

  it('starts with null ghost position', () => {
    fixture.detectChanges();
    expect(getGrid().ghostPosition()).toBeNull();
  });

  it('forwards rowHeight input to the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().rowHeight()).toBe(120);
  });

  it('forwards gap input to the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().gap()).toBe(8);
  });

  it('loads initial items on first render', () => {
    fixture.componentInstance.items = [
      {
        id: 'a',
        type: 'test',
        data: undefined,
        layout: {
          lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        },
      },
      {
        id: 'b',
        type: 'test',
        data: undefined,
        layout: {
          lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        },
      },
    ];
    fixture.detectChanges();
    expect(getGrid().currentItems()).toHaveLength(2);
  });

  it('renders the ghost element when drag is active', () => {
    fixture.componentInstance.items = [
      {
        id: 'a',
        type: 'test',
        data: undefined,
        layout: {
          lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        },
      },
    ];
    fixture.detectChanges();
    measureGrid();

    getGrid().beginDrag('a');
    fixture.detectChanges();

    const ghost = (fixture.nativeElement as HTMLElement).querySelector('.et-grid-ghost');
    expect(ghost).not.toBeNull();
  });
  describe('unrendered items', () => {
    let reportedErrors: unknown[];

    const createHost = <T>(host: Type<T>) => {
      reportedErrors = [];
      TestBed.resetTestingModule();
      Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
      TestBed.configureTestingModule({
        imports: [host],
        providers: [
          ...provideGridConfig({ registrations: [{ type: 'test', component: TestItemComponent }] }),
          { provide: ErrorHandler, useValue: { handleError: (error: unknown) => reportedErrors.push(error) } },
        ],
      });

      return TestBed.createComponent(host);
    };

    it('reports ET1904 for an item that has neither a registration nor a projected item', () => {
      const hostFixture = createHost(TestHostComponent);
      hostFixture.componentInstance.items = [
        {
          id: 'a',
          type: 'unregistered',
          data: undefined,
          layout: {
            lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
          },
        },
      ];
      hostFixture.detectChanges();

      expect(reportedErrors.map((error) => `${error}`).join('\n')).toMatch(/ET1904/);
    });

    it('stays silent when a projected et-grid-item covers the item', () => {
      const hostFixture = createHost(ProjectedHostComponent);
      hostFixture.detectChanges();

      expect(reportedErrors).toEqual([]);
    });

    it('reports ET1905 for an item that is both registered and projected', () => {
      const hostFixture = createHost(DoubleRenderedHostComponent);
      hostFixture.detectChanges();
      TestBed.tick();

      expect(reportedErrors.map((error) => `${error}`).join('\n')).toMatch(/ET1905/);
    });
  });

  describe('typed items', () => {
    it('hands the item payload type back through layoutChange', () => {
      TestBed.resetTestingModule();
      Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: ResizeObserverMock });
      TestBed.configureTestingModule({
        imports: [TypedHostComponent],
        providers: [...provideGridConfig({ registrations: [{ type: 'test', component: TestItemComponent }] })],
      });

      const typedFixture = TestBed.createComponent(TypedHostComponent);
      typedFixture.detectChanges();

      const gridEl = typedFixture.debugElement.query(By.directive(GridDirective)).nativeElement as HTMLElement;
      Object.defineProperty(gridEl, 'clientWidth', { configurable: true, value: 1216 });
      TestBed.tick();
      ResizeObserverMock.instances.forEach((instance) => instance.emit());
      typedFixture.detectChanges();

      const grid = typedFixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

      expect(grid.currentItems().map((item) => item.id)).toEqual(['a']);

      grid.moveItem('a', { col: 2, row: 0, colSpan: 1, rowSpan: 1 });
      typedFixture.detectChanges();

      const emitted = typedFixture.componentInstance.states.at(-1);

      expect(emitted?.items.find((item) => item.id === 'a')?.data.title).toBe('Widget A');
    });
  });
});
