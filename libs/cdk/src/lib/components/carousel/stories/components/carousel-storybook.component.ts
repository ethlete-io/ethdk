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

      <et-carousel-item-nav navStuff />
    </et-carousel>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    // TODO: Overlay inactive slides with a 70% black background
    .et-carousel-host {
      --_carousel-slide-direction-inactive: polygon(100% 0, 100% 0, 100% 100%, 100% 100%);
      --_carousel-slide-direction-active: polygon(0 0, 100% 0, 100% 100%, 0 100%);
      --_carousel-slide-duration: 0.5s;
      --_carousel-slide-easing: cubic-bezier(0.25, 0.64, 0.44, 1);

      --_carousel-slide-translate: 125px;

      --_carousel-slide-transform: translateX(var(--_carousel-slide-translate));
      --_carousel-slide-transform-inverse: translateX(calc(var(--_carousel-slide-translate) * -1));

      &.et-carousel--slide-left {
        --_carousel-slide-direction-inactive: polygon(0 0, 0 0, 0 100%, 0% 100%);
        --_carousel-slide-transform: translateX(calc(var(--_carousel-slide-translate) * -1));
        --_carousel-slide-transform-inverse: translateX(var(--_carousel-slide-translate));
      }
    }

    .et-carousel-items {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      background-color: #333333;
      border-radius: 10px;
      aspect-ratio: 16 / 9;
      overflow: hidden;
    }

    .et-carousel-item {
      grid-area: 1 / 1 / 2 / 2;
      border-radius: 10px;
      position: relative;
      pointer-events: none;
      transform: var(--_carousel-slide-transform);

      clip-path: var(--_carousel-slide-direction-inactive);

      &.active,
      &.previous-active {
        transition-timing-function: var(--_carousel-slide-easing);
        transition-duration: var(--_carousel-slide-duration);
        transition-property: clip-path, transform;
        clip-path: var(--_carousel-slide-direction-active);
      }

      &.active {
        z-index: 1;
        transform: translateX(0);
        pointer-events: auto;
      }

      &.previous-active {
        transform: var(--_carousel-slide-transform-inverse);
      }

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
    .et-carousel-item-nav {
      list-style: none;
      padding: 0;
      display: flex;
      gap: 10px;

      .et-carousel-item-nav-button {
        width: 10px;
        height: 10px;
        border-radius: 5px;
        background-color: #333333;
        border: 0;
        padding: 0;
        overflow: hidden;
        transition: width 0.1s linear;
        cursor: pointer;

        &--progressing {
          width: 50px;

          .et-carousel-item-nav-button-progress {
            transition: transform 0.1s linear;
          }
        }

        &--active-static {
          background-color: #ffffff;
        }
      }

      .et-carousel-item-nav-button-progress {
        width: 100%;
        height: 100%;
        background-color: #ffffff;
        transform-origin: left;
        transform: scaleX(var(--_et-carousel-item-nav-button-progress, 0));
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
