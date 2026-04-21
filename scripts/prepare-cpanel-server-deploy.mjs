import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourceServerDir = path.join(rootDir, 'dist-server', 'server');
const targetDir = path.join(rootDir, 'cpanel-server-deploy');
const targetServerDir = path.join(targetDir, 'server');

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetServerDir, { recursive: true });

await cp(sourceServerDir, targetServerDir, { recursive: true });

const packageJson = {
  name: 'velixa-api-server',
  private: true,
  version: '1.0.0',
  type: 'commonjs',
  main: 'server/index.js',
  scripts: {
    start: 'node server/index.js',
  },
  dependencies: {
    cors: '^2.8.5',
    dotenv: '^17.2.3',
    express: '^4.21.2',
    'firebase-admin': '^13.8.0',
  },
};

await writeFile(
  path.join(targetDir, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf8'
);

await writeFile(
  path.join(targetDir, 'README.txt'),
  [
    'Upload the contents of this folder to your cPanel Node.js application root.',
    'Expected cPanel settings:',
    'Application root: velixa-api',
    'Startup file: server/index.js',
    '',
    'After upload, if cPanel npm install fails, you can install dependencies locally in this folder and upload node_modules as well.',
  ].join('\n') + '\n',
  'utf8'
);
