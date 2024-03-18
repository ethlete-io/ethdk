<et-carousel autoPlay="false" autoPlayTime="5000" loop="true" pauseAutoPlayOnHover="true" pauseAutoPlayOnFocus="true" transitionType="mask-slide">
  <et-carousel-item>
    <img>
  </et-carousel-item>

  <et-carousel-item>
    <img>
  </et-carousel-item>

  <!-- Auto play time override so the whole video can be played -->
  <et-carousel-item autoPlayTime="30120"> 
    <video></video>
  </et-carousel-item>

  <div>
    <et-carousel-previous-button>
    <!-- Or -->
    <button et-carousel-previous-button>
    <et-carousel-item-nav morph="true"/>
    <et-carousel-next-button>
    <!-- Or -->
    <button et-carousel-next-button>
    <et-carousel-toggle-auto-play-button />
    <!-- Or -->
    <button et-carousel-toggle-auto-play-button>
  </div>
</et-carousel>
