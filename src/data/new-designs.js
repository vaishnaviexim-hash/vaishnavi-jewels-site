// Category helpers for New Designs (owner 20/11 16:45: one PAGE per category).
import designs from './new-designs.json';
export const CATS = ['Earrings', 'Rings', 'Necklaces', 'Pendants', 'Bangles & Bracelets', 'Bridal Sets', 'Mangalsutra', 'Others'];
export const slug = (c) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const catOf = (d) => (CATS.includes(d.cat) ? d.cat : 'Others');
export const groups = () => CATS.map((c) => ({ cat: c, slug: slug(c), items: designs.filter((d) => catOf(d) === c) })).filter((g) => g.items.length);
export { designs };

// Categories that already have a collection page get a "Fresh Designs" tab ON that page (owner 20/11 17:30);
// other categories get their own /new-designs/<slug> page.
export const HOME = { 'Earrings': '/diamond-earrings', 'Mangalsutra': '/diamond-mangalsutra', 'Bridal Sets': '/bridal-jewellery' };
export const catLink = (c) => (HOME[c] ? HOME[c] + '#fresh-designs' : '/new-designs/' + slug(c));
export const itemsOf = (c) => designs.filter((d) => catOf(d) === c);
