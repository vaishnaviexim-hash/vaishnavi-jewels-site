// After each successful production deploy, tell Bing / Yandex / Seznam etc.
// (via IndexNow) that the site's pages changed, so they re-crawl quickly.
// Reads the page list from the built sitemap, so new pages and blog posts
// are included automatically. A failure here never fails the deploy.
import { readFileSync } from 'node:fs';

const KEY = '0cff2a78044bf820b336e67aea1c1219';
const HOST = 'vaishnavijewels.com';

export const onSuccess = async ({ constants }) => {
  if (process.env.CONTEXT !== 'production') return;
  try {
    const xml = readFileSync(constants.PUBLISH_DIR + '/sitemap.xml', 'utf8');
    const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList }),
    });
    console.log('IndexNow: submitted ' + urlList.length + ' URLs, status ' + res.status);
  } catch (e) {
    console.log('IndexNow: skipped (' + e.message + ')');
  }
};
