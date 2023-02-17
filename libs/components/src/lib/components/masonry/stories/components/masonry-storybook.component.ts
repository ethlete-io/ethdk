import { NgFor, NgForOf } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { RepeatDirective } from '@ethlete/core';
import { MasonryComponent } from '../../components';
import { MasonryItemComponent } from '../../partials';

@Component({
  selector: 'et-sb-random-kitten',
  template: `
    <div [style.backgroundColor]="randomColor">
      <img
        [src]="randomUrl"
        [style.aspect-ratio]="aspectRatio"
        alt="Kitten"
        style="max-width: 100%; object-fit: cover; min-width: 100%; "
      />
      <p style="margin: 0; padding: 10px 0; ">{{ randomLorem }}</p>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RandomKittenComponent {
  readonly baseUrl = 'https://placekitten.com';

  randomWidth = this.randomNumberBetween100AndMax;
  randomHeight = this.randomNumberBetween100AndMax;

  get randomUrl() {
    return `${this.baseUrl}/${this.randomWidth}/${this.randomHeight}`;
  }

  get randomLorem() {
    const random = Math.random();

    const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nisl nec ultricies.';

    return lorem.slice(0, Math.floor(random * lorem.length));
  }

  get aspectRatio() {
    const aspectX = this.randomWidth;
    const aspectY = this.randomHeight;

    const aspectRatio = aspectX / aspectY;

    const aspectRatioString = aspectRatio.toFixed(2);

    return aspectRatioString;
  }

  get randomColor() {
    const random = Math.random();

    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'gray', 'brown', 'cyan'];

    return colors[Math.floor(random * colors.length)];
  }

  get randomNumberBetween100AndMax() {
    const random = Math.random();

    const num = Math.floor(random * 400 + 100);

    return Math.round(num / 100) * 100;
  }
}

@Component({
  selector: 'et-sb-masonry',
  template: `
    <et-masonry [gap]="gap" [columWidth]="columWidth">
      <et-masonry-item *ngFor="let item of repeat; trackBy: trackByFn" [key]="item.id"
        ><et-sb-random-kitten
      /></et-masonry-item>
    </et-masonry>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MasonryComponent, MasonryItemComponent, RepeatDirective, RandomKittenComponent, NgFor, NgForOf],
})
export class StorybookMasonryComponent implements AfterContentInit {
  gap = 16;
  columWidth = 200;

  repeat = new Array(25).fill(0).map(() => ({ id: Math.random() }));

  private readonly _cdr = inject(ChangeDetectorRef);

  ngAfterContentInit(): void {
    setTimeout(() => {
      this.repeat = new Array(25).fill(0).map(() => ({ id: Math.random() }));

      setTimeout(() => {
        this.repeat = this.repeat.concat(new Array(25).fill(0).map(() => ({ id: Math.random() })));
        this._cdr.markForCheck();
      }, 5000);

      this._cdr.markForCheck();
    }, 5000);
  }

  trackByFn(index: number, item: { id: number }) {
    return item.id;
  }
}
