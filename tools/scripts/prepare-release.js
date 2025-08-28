const packageJson = require('../../package.json');

const distJson = {
  ...packageJson,
  workspaces: ['dist/libs/*'],
};

const fs = require('fs');
const path = require('path');

fs.writeFileSync(path.join(__dirname, '..', '..', 'package.json'), JSON.stringify(distJson, null, 2));

const packageLock = fs.readFileSync(path.join(__dirname, '..', '..', 'yarn.lock'), { encoding: 'utf-8' });

const distLock = packageLock.replace(/@workspace:libs/g, '@workspace:dist/libs');

fs.writeFileSync(path.join(__dirname, '..', '..', 'yarn.lock'), distLock);
