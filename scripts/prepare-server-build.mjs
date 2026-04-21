import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist-server');

await mkdir(distDir, { recursive: true });
await writeFile(
  path.join(distDir, 'package.json'),
  JSON.stringify(
    {
      type: 'commonjs',
    },
    null,
    2
  ) + '\n',
  'utf8'
);
