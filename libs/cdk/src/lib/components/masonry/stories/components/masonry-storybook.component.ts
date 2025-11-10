import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { MasonryComponent } from '../../components/masonry';
import { MasonryItemComponent } from '../../partials/masonry-item';

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

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RandomKittenComponent {
  readonly baseUrl = 'https://placehold.co';

  randomWidth = this.randomNumberBetween100AndMax;
  randomHeight = this.randomNumberBetween100AndMax;

  get randomUrl() {
    return `${this.baseUrl}/${this.randomWidth}x${this.randomHeight}`;
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
      @for (item of repeat; track trackByFn($index, item)) {
        <et-masonry-item [key]="item.id">
          <et-sb-random-kitten />
        </et-masonry-item>
      }
    </et-masonry>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MasonryComponent, MasonryItemComponent, RandomKittenComponent],
})
export class StorybookMasonryComponent {
  gap = 16;
  columWidth = 200;

  repeat = new Array(25).fill(0).map(() => ({ id: Math.random() }));

  trackByFn(index: number, item: { id: number }) {
    return item.id;
  }
}
