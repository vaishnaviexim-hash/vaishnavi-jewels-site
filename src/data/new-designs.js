// Category helpers for New Designs (owner 20/11 16:45: one PAGE per category).
import designs from './new-designs.json';
export const CATS = ['Earrings', 'Rings', 'Necklaces', 'Pendants', 'Bangles & Bracelets', 'Bridal Sets', 'Mangalsutra', 'Others'];
export const slug = (c) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const catOf = (d) => (CATS.includes(d.cat) ? d.cat : 'Others');
export const groups = () => CATS.map((c) => ({ cat: c, slug: slug(c), items: designs.filter((d) => catOf(d) === c) })).filter((g) => g.items.length);
export { designs };
