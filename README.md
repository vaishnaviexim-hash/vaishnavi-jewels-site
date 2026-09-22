# Vaishnavi Jewels — Website (Astro rebuild)

This replaces the old 3-file (`index.html` + `instagramfeed.gs` + logo)
Netlify Drop site with a proper static site that supports an automated
blog. Same homepage content and branding — new foundation underneath.

## What changed vs. the old site

- Homepage content, copy, and SEO meta tags (title, description, Open
  Graph, Twitter card, JSON-LD) are carried over as-is.
- Blog posts are now **Markdown files** in `src/content/blog/`. Adding a
  file there = adding a live page. No manual HTML editing, ever.
- A sitemap is generated automatically on every build
  (`@astrojs/sitemap`) — no manual sitemap maintenance.
- Deploys go through **GitHub → Netlify auto-deploy**, not manual drag-and-
  drop. Every change is a reversible git commit.

## Two things to carry over manually before going live

1. **Logo image** — copy the real `logo_vaishnavi_jewels.png` (downloaded
   earlier from the old Netlify deploy) into `public/logo_vaishnavi_jewels.png`
   in this project, replacing/adding the file. It's referenced by the
   header, footer, and JSON-LD structured data.

2. **`instagramfeed.gs`** — this was a Google Apps Script file on the old
   site, likely used to pull Instagram posts into the page. It doesn't run
   inside Astro directly. If it's still needed, it should keep running
   wherever it was actually executing (Google Apps Script's own hosting,
   probably tied to a Google Sheet), and the site would just read its
   output — this is worth confirming with whoever set that up originally.
   It hasn't been rebuilt here since its role wasn't fully clear from the
   deployed files alone.

## Local setup (to test before deploying)

```
npm install
npm run dev
```

Opens at `http://localhost:4321`. Edit files, see changes live.

```
npm run build
```

Builds the static site into `dist/` — this is what actually gets deployed.

## Getting this live: GitHub + Netlify

1. Create a new GitHub repository (e.g. `vaishnavi-jewels-site`).
2. Push this project to it:
   ```
   git init
   git add .
   git commit -m "Rebuild site on Astro with blog support"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
3. In Netlify, go to the existing **vaishnavijewels.com** project →
   **Project configuration → Build & deploy → Link repository** (or
   similar, wording varies) → connect it to this new GitHub repo instead
   of Netlify Drop.
4. Set the build command to `npm run build` and the publish directory to
   `dist`.
5. Trigger a deploy. Netlify will now auto-deploy on every push to `main`.

## Leave a Review page (GPT-assisted review drafting)

`src/pages/leave-a-review.astro` + `netlify/functions/draft-review.js`

A customer fills in a short form (what they bought, what stood out), GPT
drafts a starting point in their voice, they read and edit it, then click
through to your **real Google review link** to post it themselves, on
their own Google account. Nothing gets posted automatically or on your
behalf — that would violate Google's review policies and risk the whole
Business Profile getting suspended. This tool only removes the
"blank page" friction of writing a review from scratch.

### Setup required before this works

1. **Get an OpenAI API key** from platform.openai.com (if you don't
   already have one from other work).
2. In Netlify: **Project configuration → Environment variables** → add
   `OPENAI_API_KEY` with that key as the value. Never commit the key to
   this repo.
3. Netlify Functions need the site's Netlify plan to support serverless
   functions — this is included on Netlify's free tier, so no upgrade
   should be needed.

### Sharing this page with customers

Since it's meant to be sent directly rather than browsed to, some ways to
share `vaishnavijewels.com/leave-a-review`:
- A WhatsApp message after a purchase (could be added to the existing
  Interakt/WhatsApp CRM automation as a follow-up message template)
- A QR code at the counter or on the receipt, alongside/replacing the
  existing review QR cards
- A short follow-up email

### Protecting the review-draft function from abuse

Because this calls a paid API and the page is public, it's worth adding
basic abuse protection before high-traffic sharing (e.g. a QR code
displayed publicly in-store). Two low-effort options:
- **Netlify Rate Limiting** (available on paid plans) can cap requests
  per IP to this function.
- A simple honeypot field or a delay-based check in the form can filter
  out basic bots, though this form is low-risk anyway since it needs a
  real answer typed into the "what stood out" field to produce output.



The homepage has an "From Instagram" section that reads from
`src/data/instagram-posts.json`. It's a static file, read at build time —
the site never calls Instagram directly when someone visits, which keeps
it fast and keeps it working even if Instagram's API has issues.

Format:
```json
[
  {
    "id": "unique_post_id",
    "caption": "Post caption text",
    "mediaType": "IMAGE",
    "mediaUrl": "/instagram-cache/unique_post_id.jpg",
    "permalink": "https://www.instagram.com/p/xxxxx/",
    "timestamp": "2026-09-22T00:00:00Z"
  }
]
```

Images referenced by `mediaUrl` need to actually exist in
`public/instagram-cache/` — Instagram's own image URLs expire, so images
must be downloaded and stored in this repo, not linked directly.

**This isn't automated yet.** To make it update automatically, a Make.com
scenario needs to:
1. Poll the Instagram Graph API for new posts (this requires a Meta
   Business/Developer app with Instagram Graph API access tied to your
   Instagram professional account — likely already set up if
   `instagramfeed.gs` was doing something similar before).
2. Download each new post's image and commit it to
   `public/instagram-cache/`.
3. Update `src/data/instagram-posts.json` with the new post's data.
4. Commit both to GitHub — Netlify auto-deploys, and the homepage feed
   updates.

This can run on the same schedule as the existing Instagram cross-posting
scenario, or as a new branch off it, since it needs the same source data
(new Instagram posts) that scenario already detects.

## Adding a blog post — the format an automation must follow

Every post is one file: `src/content/blog/your-post-slug.md`

```markdown
---
title: "Post Title Here"
description: "One sentence, under 160 characters, for the meta description."
pubDate: 2026-09-22
heroImage: "/blog-images/your-image.jpg"
tags: ["bridal", "diamonds"]
draft: false
---

Post content in Markdown goes here.
```

The filename becomes the URL: `your-post-slug.md` → `/blog/your-post-slug`.
This is the exact contract validated by `src/content/config.ts` — a file
missing `title`, `description`, or `pubDate`, or with a badly formatted
date, will fail the build rather than publish a broken page.

## The Make.com automation this enables

With this structure in place, the scenario becomes:

1. **Trigger** — schedule (e.g. weekly) or a topic list source.
2. **ChatGPT (OpenAI module or HTTP call)** — generate title, description,
   tags, and body in the format above.
3. **GitHub module** — commit a new file to
   `src/content/blog/<slug>.md` in this repo, on the `main` branch.
   This single commit *is* the publish action — Netlify picks it up
   automatically.
4. **Wait/poll step** — check Netlify's deploy status via its API until
   the deploy finishes (usually under a minute for a site this size).
5. **Google Search Console API** — call the URL Inspection / indexing
   endpoint for the new post's URL, same as the manual "Request Indexing"
   step done for the homepage.
6. **Gmail** — send a short confirmation with the live post URL.

Nothing in this pipeline touches the homepage or any existing page — a
bad generation only affects the one new file, and a broken build simply
fails the Netlify deploy without taking the live site down (Netlify keeps
serving the last successful build until a new one succeeds).
