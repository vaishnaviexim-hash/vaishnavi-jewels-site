import { getCollection } from 'astro:content';
import { infoPages } from '../data/business.js';

// Self-built sitemap (avoids @astrojs/sitemap, which has a known version
// compatibility bug against recent Astro releases). This runs at build
// time and automatically includes every non-draft blog post — nothing to
// maintain by hand when a new post is added.

const SITE_URL = 'https://vaishnavijewels.com';

export async function GET() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  const staticUrls = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
    ...infoPages.map((p) => ({ loc: p.path, changefreq: 'monthly', priority: '0.7' })),
    // Every job page under /careers/ is listed automatically (C-20261016-SITEMAPJOBS):
    // a new opening only needs its .astro file, nothing to add here by hand.
    ...Object.keys(import.meta.glob('./careers/*.astro'))
      .map((f) => f.replace('./careers/', '/careers/').replace(/\.astro$/, ''))
      .sort()
      .map((loc) => ({ loc, changefreq: 'weekly', priority: '0.5' })),
  ];

  const postUrls = posts.map((post) => ({
    loc: `/blog/${post.slug}`,
    lastmod: post.data.pubDate.toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: '0.6',
  }));

  const allUrls = [...staticUrls, ...postUrls];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
