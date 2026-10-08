import { defineConfig } from 'astro/config';

// This is the one line to change if the domain ever changes.
const SITE_URL = 'https://vaishnavijewels.com';

export default defineConfig({
  site: SITE_URL,
  // Build every page as a plain file (bridal-jewellery.html, not
  // bridal-jewellery/index.html). Cloudflare Pages then serves the
  // no-slash address (/bridal-jewellery) directly with no redirect, which
  // matches the sitemap, canonical tags and internal links. With folders,
  // Cloudflare redirected every page to a trailing-slash address and
  // Google reported 'Redirect error' (fixed 8 Oct 2026).
  build: { format: 'file' },
  trailingSlash: 'never',
  // Sitemap is self-built at src/pages/sitemap.xml.js (see that file for
  // why — avoids a version-compatibility bug in the official
  // @astrojs/sitemap integration). It auto-includes every blog post.
});
