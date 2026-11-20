import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const assets = [
  ['node_modules/gsap/dist/gsap.min.js', 'static/vendor/gsap.min.js'],
  ['node_modules/chart.js/dist/chart.umd.min.js', 'static/vendor/chart.umd.min.js'],
  ['node_modules/chart.js/LICENSE.md', 'static/vendor/licenses/chart.js-LICENSE.md'],
  ['node_modules/three/LICENSE', 'static/vendor/licenses/three-LICENSE.txt'],
];

for (const [source, destination] of assets) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const chartPath = 'static/vendor/chart.umd.min.js';
const chartSource = await readFile(chartPath, 'utf8');
await writeFile(chartPath, chartSource.replace(/\n?\/\/# sourceMappingURL=.*$/m, ''));

console.log(`Copied ${assets.length - 2} browser assets and their licenses.`);
