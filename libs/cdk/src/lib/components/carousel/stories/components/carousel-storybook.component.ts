import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { CarouselTransitionType } from '../../carousel.directive';
import { CarouselImports } from '../../carousel.imports';

@Component({
  selector: 'et-sb-carousel',
  template: `
    <et-carousel
      [loop]="loop"
      [autoPlay]="autoPlay"
      [autoPlayTime]="autoPlayTime"
      [transitionType]="transitionType"
      [transitionDuration]="transitionDuration"
      [pauseAutoPlayOnHover]="pauseAutoPlayOnHover"
      [pauseAutoPlayOnFocus]="pauseAutoPlayOnFocus"
    >
      <et-carousel-item>
        <img src="https://source.unsplash.com/random/1220x600" alt="img" />
      </et-carousel-item>
      <et-carousel-item [autoPlayTime]="secondItemAutoPlayTime">
        <img src="https://source.unsplash.com/random/1230x600" alt="img" />
        <button>Focus me</button>
      </et-carousel-item>
      <et-carousel-item>
        <img src="https://source.unsplash.com/random/1240x600" alt="img" />
      </et-carousel-item>
      <et-carousel-item>
        <img src="https://source.unsplash.com/random/1250x600" alt="img" />
      </et-carousel-item>
      <et-carousel-item>
        <img src="https://source.unsplash.com/random/1260x600" alt="img" />
      </et-carousel-item>

      <div class="sb-controls">
        <div class="specific-controls">
          <button etCarouselPreviousButton aria-label="Previous">Prev</button>
          <button etCarouselNextButton aria-label="Next">Next</button>

          @if (autoPlay) {
            <button etCarouselToggleAutoPlayButton aria-label="Play/Pause">Play/Pause</button>
          }
        </div>
        <et-carousel-item-nav />
      </div>
    </et-carousel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .sb-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
    }

    .specific-controls {
      display: flex;
      gap: 10px;
    }

    .et-carousel-items {
      background-color: #333333;
      border-radius: 10px;
      aspect-ratio: 16 / 9;
    }

    .et-carousel-item {
      grid-area: 1 / 1 / 2 / 2;

      &:nth-child(1) {
        background-color: #ff0000;
      }

      &:nth-child(2) {
        background-color: #00ff00;

        button {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      }

      &:nth-child(3) {
        background-color: #0000ff;
      }

      &:nth-child(4) {
        background-color: #ffff00;
      }

      &:nth-child(5) {
        background-color: #ff00ff;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  `,
  imports: [CarouselImports],
})
export class StorybookCarouselComponent {
  @Input()
  loop = true;

  @Input()
  autoPlay = false;

  @Input()
  autoPlayTime = 5000;

  @Input()
  pauseAutoPlayOnHover = true;

  @Input()
  pauseAutoPlayOnFocus = true;

  @Input()
  transitionType: CarouselTransitionType = 'mask-slide';

  @Input()
  transitionDuration = 450;

  @Input()
  secondItemAutoPlayTime = 20000;
}
