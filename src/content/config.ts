import { defineCollection, z } from 'astro:content';

// Every blog post is a single Markdown file dropped into src/content/blog/.
// This schema is the "contract" that an automated writer (e.g. a Make.com
// scenario calling ChatGPT) must follow. If a generated file is missing a
// required field, or has the wrong type, the build will fail loudly rather
// than publishing a broken page — that's intentional.
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160), // meta description length guard
    // Publish date drives sort order on the blog index.
    pubDate: z.coerce.date(),
    // Used for the <meta property="og:image"> tag and the blog card image.
    // Optional so a post can be written/published even before an image exists.
    heroImage: z.string().optional(),
    // Free-form tags, e.g. ["bridal", "polki", "diamond-guide"]
    tags: z.array(z.string()).default([]),
    // Set true to hide a post without deleting the file (handy for drafts
    // an automation writes but a human hasn't reviewed yet).
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
