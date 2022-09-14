const packageJson = require('../../package.json');

const distJson = {
  ...packageJson,
  workspaces: ['dist/libs/*'],
};

const fs = require('fs');
const path = require('path');

fs.writeFileSync(path.join(__dirname, '..', '..', 'package.json'), JSON.stringify(distJson, null, 2));
