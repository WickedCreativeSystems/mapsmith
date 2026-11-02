import { describe, expect, it } from 'vitest';
import { KINDS, blockFor, foundryPlacements, make, sceneData } from '../foundry/make';

describe('Mapsmith for Foundry', () => {
	for (const kind of KINDS)
		it(`makes a ${kind} with its key, walls and no painted texture`, () => {
			const r = make(blockFor(kind, 'saltmarch', {}));
			expect(r.scenes.length).toBeGreaterThan(0);
			expect(r.entries.length).toBeGreaterThan(0);
			for (const m of r.scenes) {
				expect(m.svg).not.toMatch(/data:image\/(png|jpe?g|webp)/);
				expect(m.w).toBe(m.data.resolution.map_size.x * m.data.resolution.pixels_per_grid);
				const { walls, lights } = foundryPlacements(m.data, m.distance);
				expect(walls.length).toBeGreaterThan(0);
				for (const w of walls) for (const v of w.c) expect(v >= 0 && v <= Math.max(m.w, m.h)).toBe(true);
				for (const l of lights) expect(l.color).toMatch(/^#[0-9a-f]{6}$/);
			}
		});
	it('passes the choices through and gives the same map for the same seed', () => {
		const b = blockFor('dungeon', 'saltmarch', { kind: 'mine', size: 'lair' });
		expect(b).toBe('map: dungeon\nseed: saltmarch\nkind: mine\nsize: lair\nlook: plain');
		expect(make(b).scenes[0]?.svg).toBe(make(b).scenes[0]?.svg);
	});
	it('says what is wrong with a bad choice', () => {
		expect(() => make(blockFor('dungeon', 'x', { kind: 'volcano' }))).toThrow(/kind can be/);
	});

	it('puts the picture on a level when Foundry has levels (v14), and only on the scene when not (v13)', () => {
		const m = make(blockFor('dungeon', 'saltmarch', {})).scenes[0]!;
		const v14 = sceneData(m, 'mapsmith/x.png', false, 'j', 20, 'defaultLevel0000') as Record<string, unknown>;
		expect(v14.levels).toEqual([{ _id: 'defaultLevel0000', name: m.name, background: { src: 'mapsmith/x.png' } }]);
		expect(v14.initialLevel).toBe('defaultLevel0000');
		const v13 = sceneData(m, 'mapsmith/x.png', false) as Record<string, unknown>;
		expect(v13.levels).toBeUndefined();
		expect(v13.background).toEqual({ src: 'mapsmith/x.png' });
	});
});
