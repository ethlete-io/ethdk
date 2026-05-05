const fs = require('fs');
const path = require('path');

const workspaceRoot = path.join(__dirname, '..', '..');
const sourceRoot = path.join(workspaceRoot, 'libs', 'eslint-plugin');
const outputRoot = path.join(workspaceRoot, 'dist', 'libs', 'eslint-plugin');

const filesToCopy = ['CHANGELOG.md', 'README.md', 'package.json'];

fs.rmSync(outputRoot, { force: true, recursive: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const fileName of filesToCopy) {
  fs.copyFileSync(path.join(sourceRoot, fileName), path.join(outputRoot, fileName));
}

fs.cpSync(path.join(sourceRoot, 'src'), path.join(outputRoot, 'src'), {
  filter: (sourcePath) => !sourcePath.endsWith('.spec.js') && !sourcePath.endsWith('.test.js'),
  recursive: true,
});
