// Shared numbers for the lab-grown diamond price pages (owner 27/11/2026 13:59-14:03: India + worldwide price search).
// Everything is worked out at build time from our live Diamond Search stock (public/stock/*.json): our own selling price only.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'stock');
export const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
export const INR: number = idx.inr || 93;
const cache: Record<string, any[]> = {};
export function load(name: string): any[] {
  if (cache[name]) return cache[name];
  const s = (idx.shapes || []).find((x: any) => x.name === name);
  let L: any[] = [];
  if (s) { try { L = JSON.parse(fs.readFileSync(path.join(dir, s.file), 'utf8')); } catch { L = []; } }
  return (cache[name] = L);
}
// record: [code, ct, col, cla, cut, pol, sym, fl, tbl, dep, lab, meas, usd_ct, video, date, image, ...]
export const certified = (r: any[]) => ['IGI', 'GIA', 'GCAL', 'SGL'].includes(r[10]);
export const stoneInr = (r: any[]) => r[12] * r[1] * INR;
const r500 = (v: number) => Math.round(v / 500) * 500;
export const inr = (v: number) => '₹' + r500(v).toLocaleString('en-IN');
export const usd = (v: number) => 'USD ' + (Math.round(v / INR / 5) * 5).toLocaleString('en-US');
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export const total: number = (idx.shapes || []).reduce((s: number, x: any) => s + (x.n || 0), 0);
export const updTxt: string = idx.updated ? new Date(idx.updated + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
export const SHAPES = ['Round', 'Oval', 'Pear', 'Emerald', 'Cushion', 'Radiant', 'Princess', 'Marquise', 'Heart', 'Asscher'];
export const GOODCUT = ['EX', 'ID', '8X'];

export function stats(L0: any[]) {
  // drop odd listings (a per-carat price over 2.5x the group's median) so one stray price never sets the table
  const m = median(L0.map((r) => r[12]));
  const L = L0.filter((r) => r[12] <= m * 2.5);
  const p = L.map(stoneInr);
  return { n: L.length, from: p.length ? Math.min(...p) : 0, typ: median(p), perCt: median(L.map((r) => r[12] * INR)) };
}

// carat pages: slug -> [label, min ct, max ct)
export const CARATS: Record<string, [string, number, number]> = {
  '1-carat': ['1 carat', 1.0, 1.1],
  '1-5-carat': ['1.5 carat', 1.5, 1.6],
  '2-carat': ['2 carat', 2.0, 2.2],
  '3-carat': ['3 carat', 3.0, 3.3],
};
