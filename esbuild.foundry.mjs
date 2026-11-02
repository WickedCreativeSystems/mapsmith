// The Foundry VTT module: foundry/module.ts bundled with the plugin's generators, a manifest and a zip, served from
// /mapsmith/foundry/ on the site. Installed in Foundry by its manifest URL.
import esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const VERSION = '1.0.2';
const SITE = 'https://bulkhead.bananafest-destiny.com/mapsmith/foundry';
const out = new URL('../../public/mapsmith/foundry/', import.meta.url).pathname;
const tmp = new URL('../../../.tools/foundry-mapsmith/', import.meta.url).pathname;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(`${tmp}mapsmith/scripts`, { recursive: true });
mkdirSync(out, { recursive: true });
await esbuild.build({
	entryPoints: ['foundry/module.ts'],
	bundle: true,
	format: 'esm',
	target: 'es2022',
	minify: true,
	alias: { obsidian: './test/obsidian-shim.ts' },
	outfile: `${tmp}mapsmith/scripts/mapsmith.js`,
	logLevel: 'info',
});
const js = readFileSync(`${tmp}mapsmith/scripts/mapsmith.js`, 'utf8');
if (/data:image\/(png|jpe?g|webp)/.test(js)) throw new Error('the Foundry module would carry a painted texture');
const manifest = {
	id: 'mapsmith',
	title: 'Mapsmith: towns, dungeons and ships from a seed',
	description:
		'A Mapsmith map button in the Scenes tab. Pick a town, dungeon, ship or building and a seed, and Mapsmith draws the map, sets the grid, and makes a scene with every place or room numbered in a GM-only journal. The same seed gives the same map in Obsidian and on the web. With a Mapsmith Pro key ($6 once, on itch) each scene also gets its walls, doors and lights.',
	version: VERSION,
	compatibility: { minimum: '13', verified: '14' },
	authors: [{ name: 'Bananafest Destiny', url: 'https://bulkhead.bananafest-destiny.com/mapsmith/' }],
	url: `${SITE}/`,
	manifest: `${SITE}/module.json`,
	download: `${SITE}/mapsmith-foundry.zip`,
	readme: `${SITE}/README.md`,
	license: `${SITE}/LICENSE.txt`,
	esmodules: ['scripts/mapsmith.js'],
	styles: ['styles/mapsmith.css'],
	flags: { mapsmith: { source: 'https://github.com/walkertbrown/mapsmith' } },
};
mkdirSync(`${tmp}mapsmith/styles`, { recursive: true });
copyFileSync('foundry/styles.css', `${tmp}mapsmith/styles/mapsmith.css`);
copyFileSync('foundry/README.md', `${tmp}mapsmith/README.md`);
copyFileSync('LICENSE', `${tmp}mapsmith/LICENSE.txt`);
writeFileSync(`${tmp}mapsmith/module.json`, JSON.stringify(manifest, null, 2) + '\n');
rmSync(`${out}mapsmith-foundry.zip`, { force: true });
// Foundry wants module.json at the zip's top, not in a folder
execFileSync('zip', ['-qrX', `${out}mapsmith-foundry.zip`, '.'], { cwd: `${tmp}mapsmith` });
for (const f of ['module.json', 'README.md', 'LICENSE.txt']) copyFileSync(`${tmp}mapsmith/${f}`, `${out}${f}`);
console.log(`Mapsmith for Foundry ${VERSION}: ${Math.round(js.length / 1024)} KB of script`);
