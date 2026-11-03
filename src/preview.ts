import { App, Modal } from 'obsidian';
import type { UVTT } from './vtt';

/** Draws the players' map with what a .dd2vtt would carry over it: walls red, doors blue, windows green, lights yellow. */
export async function drawPreview(cv: HTMLCanvasElement, d: UVTT, png: string) {
	const img = new Image();
	img.src = 'data:image/png;base64,' + png;
	await img.decode();
	const k = Math.min(1, 1400 / img.width), g = d.resolution.pixels_per_grid * k;
	cv.width = Math.round(img.width * k);
	cv.height = Math.round(img.height * k);
	const c = cv.getContext('2d');
	if (!c) return;
	c.drawImage(img, 0, 0, cv.width, cv.height);
	const line = (pts: { x: number; y: number }[], colour: string, w: number) => {
		c.strokeStyle = colour;
		c.lineWidth = w;
		c.lineCap = 'round';
		c.beginPath();
		pts.forEach((q, i) => (i ? c.lineTo(q.x * g, q.y * g) : c.moveTo(q.x * g, q.y * g)));
		c.stroke();
	};
	const w = Math.max(2, g / 8);
	for (const l of d.line_of_sight) line(l, '#e8322c', w);
	for (const l of d.objects_line_of_sight) line(l, '#e8322c', w / 2);
	for (const q of d.portals) line(q.bounds, q.closed ? '#2f7cf6' : '#2fbf5a', w * 1.6);
	for (const l of d.lights) {
		c.fillStyle = 'rgba(255, 200, 60, .9)';
		c.beginPath();
		c.arc(l.position.x * g, l.position.y * g, Math.max(3, g / 4), 0, Math.PI * 2);
		c.fill();
	}
}

/** One sentence counting what this map's file would carry. */
export function previewCount(d: UVTT): string {
	const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
	const doors = d.portals.filter((q) => q.closed).length, windows = d.portals.length - doors, walls = d.line_of_sight.length + d.objects_line_of_sight.length;
	const parts = [n(walls, 'wall', 'walls'), n(doors, 'door', 'doors'), ...(windows ? [n(windows, 'window or barred gate', 'windows and barred gates')] : []), ...(d.lights.length ? [n(d.lights.length, 'light', 'lights')] : [])];
	return walls ? `This one has ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.` : 'A region has no walls: it saves as a travel map with its place names on it, a kilometre a square, ready to drop into a scene.';
}

const SAVE = 'Save for virtual tabletop', PRO = 'Mapsmith Pro';
const LEGEND = [['mapsmith-w', 'walls red'], ['mapsmith-d', 'doors blue'], ['mapsmith-g', 'windows green'], ['mapsmith-l', 'lights yellow']] as const;

/** Without a key, Save for virtual tabletop shows what the file would carry, drawn over this map, beside the buy link. */
export class ProPreview extends Modal {
	constructor(app: App, private d: UVTT, private png: string, private buy: string) {
		super(app);
	}

	onOpen() {
		this.setTitle(`What ${SAVE} would give you`);
		const el = this.contentEl;
		el.addClass('mapsmith-preview');
		el.createEl('p', { text: `This map as a .dd2vtt: the players' map with its walls, doors, windows and lights placed, so Roll20 and Foundry know where tokens can walk and see. ${previewCount(this.d)}` });
		const key = el.createEl('p', { cls: 'mapsmith-preview-key' });
		for (const [cls, what] of LEGEND) key.createSpan({ cls, text: what });
		const cv = el.createEl('canvas');
		drawPreview(cv, this.d, this.png).catch(() => cv.remove());
		const row = el.createDiv({ cls: 'mapsmith-preview-buy' });
		row.createEl('a', { text: `${PRO}, $6 once`, cls: 'mod-cta', href: this.buy });
		row.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close());
		el.createEl('p', { text: `After you buy, paste your download page's address as the Pro key in this plugin's settings. One key works in Obsidian and on the web.`, cls: 'setting-item-description' });
	}

	onClose() {
		this.contentEl.empty();
	}
}
