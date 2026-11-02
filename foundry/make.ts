// What the Foundry module makes from a seed: one scene per map (a ship or a building gives one per deck or floor),
// each with the players' picture as an SVG, its Universal VTT data for walls, doors and lights, and the GM's key.
// Always the plain look: the module carries no generated art. Pure code, so it is tested with the plugin's own tests.
import { generateBuilding } from '../src/building';
import { generateDungeon } from '../src/dungeon';
import { parseBlock, type MapKind } from '../src/block';
import { LIGHT, renderTown, toString } from '../src/render';
import { hashSeed } from '../src/rng';
import { generate } from '../src/ship/generate';
import { keyEntries } from '../src/ship/model';
import { DUNGEON_LIGHT, SHIP_LIGHT, renderDeck } from '../src/ship/svg';
import { generateTown } from '../src/town';
import { gridPixels, townMetres, townUvttData, uvttData, type UVTT } from '../src/vtt';

export const KINDS = ['town', 'dungeon', 'ship', 'building'] as const satisfies readonly MapKind[];
export type Kind = (typeof KINDS)[number];

export interface Entry {
	num: number;
	name: string;
	/** lines of text: who is there, what is in it, the hook */
	lines: string[];
}

export interface Made {
	/** the scene's name */
	name: string;
	/** the players' picture, an SVG sized w x h pixels */
	svg: string;
	w: number;
	h: number;
	/** walls, doors and lights in grid squares, and the pixels a square */
	data: UVTT;
	/** one square, in the grid's units: a town's squares are metres, a plan's are five feet */
	distance: number;
	units: string;
}

export interface Result {
	/** the map's own name, for the journal */
	title: string;
	/** what happened here, a paragraph each */
	brief: string[];
	scenes: Made[];
	entries: Entry[];
	/** the block a Mapsmith note would use, so the same map opens in Obsidian or on the web */
	block: string;
}

/** Choices from the module's form, as a Mapsmith block; parseBlock fills in the rest exactly as in Obsidian. */
export function blockFor(kind: Kind, seed: string, choice: Record<string, string>): string {
	const lines = [`map: ${kind}`, `seed: ${seed}`];
	for (const [k, v] of Object.entries(choice)) if (v && /^[a-z]+$/.test(k)) lines.push(`${k}: ${v}`);
	return [...lines, 'look: plain'].join('\n');
}

function sized(svg: { a: Record<string, string | number> }, data: UVTT) {
	const { x, y } = data.resolution.map_size;
	const px = (data.resolution.pixels_per_grid = gridPixels(x, y));
	svg.a.width = x * px;
	svg.a.height = y * px;
	return { w: x * px, h: y * px };
}

export function make(block: string): Result {
	const p = parseBlock(block);
	if (p.problems.length) throw new Error(p.problems.join('. '));
	if (p.map === 'town') {
		const t = generateTown(p.opts);
		const data = townUvttData(t, 0), m = townMetres(t);
		const pic = renderTown(t, { palette: LIGHT, labels: false });
		pic.a.viewBox = `0 0 ${(data.resolution.map_size.x * m) / t.mpu} ${(data.resolution.map_size.y * m) / t.mpu}`;
		const { w, h } = sized(pic, data);
		return {
			title: t.name,
			brief: [],
			scenes: [{ name: t.name, svg: toString(pic), w, h, data, distance: m, units: 'm' }],
			entries: t.places.map((pl) => ({ num: pl.n, name: pl.name, lines: [pl.keeper ? `${pl.label}, kept by ${pl.keeper}` : pl.label, pl.detail, `Hook: ${pl.hook}`] })),
			block,
		};
	}
	let s, palette;
	if (p.map === 'dungeon') {
		const made = generateDungeon(p.dungeon.size, p.dungeon.kind, p.dungeon.seed);
		s = p.dungeon.name ? { ...made, name: p.dungeon.name } : made;
		palette = { ...DUNGEON_LIGHT, rock: p.dungeon.kind !== 'keep' ? DUNGEON_LIGHT.rock : undefined };
	} else if (p.map === 'building') {
		s = generateBuilding(p.building.kind, p.building.seed, p.building.name, p.building.keeper);
		palette = { ...DUNGEON_LIGHT, rock: undefined };
	} else if (p.map === 'ship') {
		s = generate(p.ship.size, p.ship.mood, hashSeed(p.ship.seed));
		palette = SHIP_LIGHT;
	} else throw new Error(`Mapsmith for Foundry makes towns, dungeons, ships and buildings, not a ${p.map}`);
	const title = s.name.replace(/^Derelict — /, '');
	const many = s.decks.length > 1;
	const scenes = s.decks.map((deck) => {
		const data = uvttData(deck, 0);
		const pic = renderDeck(deck, { palette, id: 'vtt', players: true });
		const { w, h } = sized(pic, data);
		return { name: many ? `${title}, ${deck.name.toLowerCase()}` : title, svg: toString(pic), w, h, data, distance: 5, units: 'ft' };
	});
	const entries = s.decks.flatMap((deck) => keyEntries(deck).map((r) => ({ num: r.num, name: many ? `${r.name} (${deck.name.toLowerCase()})` : r.name, lines: r.notes.split('\n').filter(Boolean) })));
	return { title, brief: s.brief.split('\n\n').filter(Boolean), scenes, entries, block };
}

/** Foundry's walls and lights from the Universal VTT data, the way the Universal Battlemap Importer reads the same file:
 *  every line of sight is a wall, every portal a door (closed ones shut, open ones open), and lights keep their colour. */
export function foundryPlacements(data: UVTT, distance: number) {
	const P = data.resolution.pixels_per_grid;
	const at = (v: number) => Math.round(v * P);
	const walls: { c: number[]; door: number; ds: number }[] = [];
	for (const line of [...data.line_of_sight, ...data.objects_line_of_sight])
		for (let i = 1; i < line.length; i++) {
			const a = line[i - 1], b = line[i];
			if (a && b) walls.push({ c: [at(a.x), at(a.y), at(b.x), at(b.y)], door: 0, ds: 0 });
		}
	for (const d of data.portals) {
		const [a, b] = d.bounds;
		if (a && b) walls.push({ c: [at(a.x), at(a.y), at(b.x), at(b.y)], door: 1, ds: d.closed ? 0 : 1 });
	}
	// a light's range is in squares; Foundry's is in the grid's units
	const lights = data.lights.map((l) => ({ x: at(l.position.x), y: at(l.position.y), dim: Math.round(l.range * distance * 10) / 10, bright: Math.round(((l.range * distance) / 2) * 10) / 10, color: `#${l.color.replace(/^#/, '').slice(-6)}` }));
	return { walls, lights };
}

/** The scenes' scene data: the picture's path, the grid, and with Pro the walls, doors and lights.
 *  Foundry 14 keeps a scene's picture on its levels, not on the scene (2 Nov: a v14 scene given only `background`
 *  came out with no map), so with a level id the picture goes on one level as well. Foundry 13 has no levels. */
export function sceneData(m: Made, src: string, pro: boolean, journal?: string, N = 20, level?: string) {
	const P = m.data.resolution.pixels_per_grid;
	const levels = level ? { levels: [{ _id: level, name: m.name, background: { src } }], initialLevel: level } : {};
	const base = { name: m.name, width: m.w, height: m.h, padding: 0, background: { src }, ...levels, grid: { type: 1, size: P, distance: m.distance, units: m.units }, tokenVision: true, environment: { globalLight: { enabled: true } }, ...(journal ? { journal } : {}) };
	if (!pro) return base;
	const { walls, lights } = foundryPlacements(m.data, m.distance);
	return {
		...base,
		walls: walls.map((w) => ({ c: w.c, move: N, sight: N, light: N, sound: N, door: w.door, ds: w.ds })),
		lights: lights.map((l) => ({ x: l.x, y: l.y, walls: true, config: { dim: l.dim, bright: l.bright, color: l.color, alpha: 0.4 } })),
	};
}
