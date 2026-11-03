// Mapsmith in Foundry VTT: a button in the Scenes tab makes a town, dungeon, ship or building from a seed as a scene,
// with its grid set and the GM's key as a journal. With a Mapsmith Pro key the scene also gets its walls, doors and
// lights. The map is drawn in the browser and uploaded to the world's data folder; the only call out is the key check.
import { DUNGEON_KINDS, DUNGEON_SIZES } from '../src/dungeon';
import { BUILDING_KINDS } from '../src/building';
import { SHIP_SIZES, newSeed } from '../src/block';
import { SIZES, WATERS } from '../src/town';
import { blockFor, make, sceneData, type Kind, type Made, type Result } from './make';

// The parts of Foundry's globals this module uses. This file runs in Foundry, never in Obsidian.
interface Notifications {
	info(msg: string): void;
	warn(msg: string): void;
	error(msg: string): void;
}
interface Doc {
	id?: string;
	name?: string;
	update(data: Record<string, unknown>): Promise<unknown>;
	createThumbnail(): Promise<{ thumb: string }>;
	view(): Promise<unknown>;
}
interface FilePicker {
	createDirectory(source: string, path: string, options: object): Promise<unknown>;
	upload(source: string, path: string, file: File, body: object, options: object): Promise<{ path?: string } | false | void>;
}
declare const game: {
	user: { isGM: boolean };
	settings: {
		register(ns: string, key: string, data: Record<string, unknown>): void;
		get(ns: string, key: string): unknown;
		set(ns: string, key: string, value: unknown): Promise<unknown>;
	};
};
declare const ui: { notifications: Notifications };
declare const Hooks: {
	once<A extends unknown[]>(hook: string, fn: (...args: A) => void): number;
	on<A extends unknown[]>(hook: string, fn: (...args: A) => void): number;
};
declare const foundry: {
	applications: {
		api: { DialogV2: { wait(options: Record<string, unknown>): Promise<unknown> } };
		apps: { FilePicker: { implementation: FilePicker } };
	};
};
declare const Scene: { create(data: object): Promise<Doc | undefined>; schema?: { has?(key: string): boolean }; metadata?: { defaultLevelId?: string } };
declare const JournalEntry: { create(data: object): Promise<Doc | undefined> };
declare const CONST: { WALL_SENSE_TYPES?: { NORMAL?: number } } | undefined;

const ID = 'mapsmith';
const SERVER = 'https://bulkhead.bananafest-destiny.com';
const BUY = 'https://bananafestdestiny.itch.io/mapsmith-pro';

const field = (data: FormData, key: string) => {
	const v = data.get(key);
	return typeof v === 'string' ? v : '';
};
const word = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace('-', ' ');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** What each kind of map lets you choose, as the block's keys */
const CHOICES: Record<Kind, [string, string, readonly string[], string][]> = {
	town: [
		['size', 'Size', SIZES, 'town'],
		['water', 'Water', WATERS, 'river'],
	],
	dungeon: [
		['kind', 'Kind', DUNGEON_KINDS, 'crypt'],
		['size', 'Size', DUNGEON_SIZES, 'dungeon'],
	],
	ship: [
		['size', 'Size', SHIP_SIZES, 'corvette'],
		['mood', 'State', ['intact', 'derelict'], 'intact'],
	],
	building: [['kind', 'Kind', BUILDING_KINDS, 'inn']],
};

Hooks.once('init', () => {
	game.settings.register(ID, 'key', {
		name: 'Mapsmith Pro key',
		hint: `With a Mapsmith Pro key, every map comes with its walls, doors and lights placed. It is $6 once: ${BUY}. Paste the address of your download page, or the key at the end of it. The key is checked once with Mapsmith's server.`,
		scope: 'world',
		config: true,
		type: String,
		default: '',
		onChange: (v: string) => void checkKey(v),
	});
	game.settings.register(ID, 'pro', { scope: 'world', config: false, type: Boolean, default: false });
});

async function checkKey(key: string) {
	if (!game.user.isGM) return;
	if (!key.trim()) {
		await game.settings.set(ID, 'pro', false);
		return;
	}
	try {
		const r = await window.fetch(`${SERVER}/api/mapsmith/key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key.trim() }) });
		const got = (await r.json()) as { ok?: boolean; buy?: string };
		await game.settings.set(ID, 'pro', !!got.ok);
		if (got.ok) ui.notifications.info('Mapsmith: good key. New maps come with their walls, doors and lights.');
		else ui.notifications.warn(`Mapsmith: itch doesn't know that key for Mapsmith Pro. Keys are on your itch download page.`);
	} catch {
		ui.notifications.error('Mapsmith: could not check the key. Check the connection and save it again.');
	}
}

Hooks.on('renderSceneDirectory', (_app: unknown, html: HTMLElement | { 0: HTMLElement }) => {
	if (!game.user.isGM) return;
	const root = html instanceof HTMLElement ? html : html[0];
	if (!root || root.querySelector('.mapsmith-new')) return;
	const where = root.querySelector('.header-actions') ?? root.querySelector('.directory-header');
	if (!where) return;
	const doc = root.ownerDocument;
	const b = doc.createElement('button');
	b.type = 'button';
	b.className = 'mapsmith-new';
	const icon = doc.createElement('i');
	icon.className = 'fa-solid fa-map';
	b.append(icon, ' Mapsmith map');
	b.addEventListener('click', () => void ask());
	where.append(b);
});

function form(kind: Kind, seed: string): string {
	const opts = (list: readonly string[], v: string) => list.map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${esc(word(x))}</option>`).join('');
	const groups = (Object.keys(CHOICES) as Kind[])
		.map((k) => `<fieldset data-for="${k}"${k === kind ? '' : ' hidden'}>${CHOICES[k].map(([key, label, list, v]) => `<div class="form-group"><label>${label}</label><select name="${k}.${key}">${opts(list, v)}</select></div>`).join('')}</fieldset>`)
		.join('');
	const pro = game.settings.get(ID, 'pro') as boolean;
	return `<div class="mapsmith-form">
<div class="form-group"><label>Map</label><select name="kind">${opts(Object.keys(CHOICES), kind)}</select></div>
${groups}
<div class="form-group"><label>Seed</label><input type="text" name="seed" value="${esc(seed)}"></div>
<p class="hint">The same seed always gives the same map, here, in Obsidian and on the web. ${pro ? 'Walls, doors and lights come with it.' : `The map, its grid and the GM's key are free. Walls, doors and lights come with <a href="${BUY}" target="_blank" rel="noopener">Mapsmith Pro</a>, $6 once.`}</p>
</div>`;
}

export async function ask() {
	const { DialogV2 } = foundry.applications.api;
	const got = await DialogV2.wait({
		window: { title: 'New Mapsmith map', icon: 'fa-solid fa-map' },
		position: { width: 440 },
		content: form('dungeon', newSeed()),
		render: (_e: Event, dialog: HTMLElement | { element?: HTMLElement }) => {
			const el = dialog instanceof HTMLElement ? dialog : dialog.element;
			if (!el) return;
			const kind = el.querySelector<HTMLSelectElement>('select[name=kind]');
			kind?.addEventListener('change', () => el.querySelectorAll<HTMLElement>('fieldset[data-for]').forEach((f) => (f.hidden = f.dataset.for !== kind.value)));
		},
		buttons: [
			{
				action: 'make',
				label: 'Make the scene',
				icon: 'fa-solid fa-hammer',
				default: true,
				callback: (_e: Event, button: HTMLButtonElement) => {
					const data = new FormData(button.form ?? undefined);
					const kind = field(data, 'kind') as Kind;
					const choice: Record<string, string> = {};
					for (const [key] of CHOICES[kind]) choice[key] = field(data, `${kind}.${key}`);
					return { kind, seed: field(data, 'seed').trim() || newSeed(), choice };
				},
			},
			{ action: 'cancel', label: 'Cancel' },
		],
		rejectClose: false,
	});
	if (!got || typeof got !== 'object') return;
	const { kind, seed, choice } = got as { kind: Kind; seed: string; choice: Record<string, string> };
	try {
		ui.notifications.info('Mapsmith: drawing the map…');
		await build(make(blockFor(kind, seed, choice)));
	} catch (e) {
		ui.notifications.error(`Mapsmith could not make that map: ${e instanceof Error ? e.message : String(e)}`);
	}
}

export async function png(m: Made): Promise<Blob> {
	const url = URL.createObjectURL(new Blob([m.svg], { type: 'image/svg+xml' }));
	try {
		const img = new Image();
		await new Promise<void>((ok, fail) => {
			img.onload = () => ok();
			img.onerror = () => fail(new Error('the map would not draw'));
			img.src = url;
		});
		const c = img.ownerDocument.createElement('canvas');
		c.width = m.w;
		c.height = m.h;
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('no canvas to draw on');
		ctx.drawImage(img, 0, 0, m.w, m.h);
		return await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('the picture would not save'))), 'image/png'));
	} finally {
		URL.revokeObjectURL(url);
	}
}

const fileName = (name: string, seed: string) => `${name}-${seed}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function journalPages(r: Result) {
	const p = (lines: string[]) => lines.map((l) => {
		const m = /^(Hazard|Salvage|Treasure|Way in|Hook|Inside|Hidden): (.*)$/.exec(l);
		return m ? `<p><strong>${esc(m[1] as string)}:</strong> ${esc(m[2] as string)}</p>` : `<p>${esc(l)}</p>`;
	}).join('');
	const about = `${p(r.brief)}<p>Made with Mapsmith. To open the same map in Obsidian or at ${SERVER}/mapsmith/, use this block:</p><pre>${esc(r.block)}</pre>`;
	return [{ name: 'About this map', type: 'text', text: { content: about } }, ...r.entries.map((e, i) => ({ name: `${e.num}. ${e.name}`, type: 'text', sort: (i + 1) * 1000, text: { content: p(e.lines) } }))];
}

async function build(r: Result) {
	const pro = game.settings.get(ID, 'pro') as boolean;
	const FP = foundry.applications.apps.FilePicker.implementation;
	await FP.createDirectory('data', ID, {}).catch(() => undefined);
	const seed = /^seed: (.*)$/m.exec(r.block)?.[1] ?? '';
	const journal = await JournalEntry.create({ name: `${r.title}: the GM's key`, pages: journalPages(r) });
	// Foundry 14 puts the picture on a level; 13 has none
	const level: string | undefined = Scene.schema?.has?.('levels') ? Scene.metadata?.defaultLevelId : undefined;
	let first: Doc | undefined;
	for (const m of r.scenes) {
		const file = new File([await png(m)], `${fileName(m.name, seed)}.png`, { type: 'image/png' });
		const up = await FP.upload('data', ID, file, {}, { notify: false });
		const src = (up && up.path) || `${ID}/${file.name}`;
		const scene = await Scene.create(sceneData(m, src, pro, journal?.id, CONST?.WALL_SENSE_TYPES?.NORMAL, level));
		if (!scene) continue;
		first ??= scene;
		try {
			const t = await scene.createThumbnail();
			await scene.update({ thumb: t.thumb });
		} catch {
			// a scene without a thumbnail still works
		}
	}
	const n = r.scenes.length;
	ui.notifications.info(`Mapsmith made ${n === 1 ? 'the scene' : `${n} scenes`} and the GM's key, "${journal?.name ?? r.title}".${pro ? '' : ` Walls, doors and lights come with Mapsmith Pro: ${BUY}`}`);
	await first?.view();
}
