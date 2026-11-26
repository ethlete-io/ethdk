import { installDemoClock } from './demo/demo-clock';
import { installDemoSeed } from './demo/demo-seed';

installDemoClock();
installDemoSeed();

import('./main.e2e').catch((error) => console.error(error));
