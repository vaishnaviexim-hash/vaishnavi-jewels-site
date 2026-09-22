import { defineConfig } from 'astro/config';

// This is the one line to change if the domain ever changes.
const SITE_URL = 'https://vaishnavijewels.com';

export default defineConfig({
  site: SITE_URL,
  // Sitemap is self-built at src/pages/sitemap.xml.js (see that file for
  // why — avoids a version-compatibility bug in the official
  // @astrojs/sitemap integration). It auto-includes every blog post.
});
