import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const docsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

const blogsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = {
  docs: docsCollection,
  blogs: blogsCollection,
};
