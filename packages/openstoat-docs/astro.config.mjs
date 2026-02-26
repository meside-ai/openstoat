// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import remarkDirective from 'remark-directive';
import { remarkAdmonition, DEFAULT_ADMONITION_TYPES } from 'remark-admonition';

// Add "info" as alias for note (GitBook-style)
const admonitionTypes = new Map([
  ...DEFAULT_ADMONITION_TYPES,
  ['info', { defaultLabel: 'Info' }],
]);

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  markdown: {
    remarkPlugins: [
      remarkDirective,
      [remarkAdmonition, { types: admonitionTypes }],
    ],
  },

  vite: {
    plugins: [tailwindcss()]
  }
});