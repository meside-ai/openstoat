/**
 * HTML template helpers with pixel-style UI.
 * Minimal CSS, high contrast, monospace.
 */

import type { FilterParams } from './routes/filters';
import { buildUrl } from './routes/filters';

const BASE_STYLES = `
body { font-family: "Courier New", monospace; font-size: 14px; margin: 16px; background: #f5f5f0; color: #111; }
h1, h2 { font-size: 16px; margin: 8px 0; }
nav { margin-bottom: 16px; padding: 8px; border: 2px solid #000; background: #fff; }
nav a { margin-right: 12px; color: #0066cc; text-decoration: none; }
nav a:hover { text-decoration: underline; }
nav a.active { font-weight: bold; color: #000; }
table { border: 2px solid #000; border-collapse: collapse; background: #fff; }
th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
th { background: #e0e0e0; }
a { color: #0066cc; }
a:hover { text-decoration: underline; }
.filter-form { margin-bottom: 12px; padding: 8px; border: 2px solid #000; background: #fff; }
.filter-form label { margin-right: 8px; }
.filter-form select { font-family: inherit; padding: 2px 4px; border: 1px solid #000; }
.filter-form input[type="submit"] { font-family: inherit; padding: 4px 8px; border: 2px solid #000; background: #fff; cursor: pointer; }
.filter-form input[type="submit"]:hover { background: #e0e0e0; }
.detail-section { margin: 12px 0; padding: 8px; border: 2px solid #000; background: #fff; }
.detail-section h2 { margin-top: 0; }
pre { background: #fff; border: 1px solid #000; padding: 8px; overflow-x: auto; font-size: 12px; }
`;

export function page(
  title: string,
  body: string,
  params: FilterParams,
  basePath = '/'
): string {
  const navLinks = [
    { view: 'plans' as const, label: 'Plans' },
    { view: 'tasks' as const, label: 'Tasks' },
    { view: 'templates' as const, label: 'Templates' },
    { view: 'handoffs' as const, label: 'Handoffs' },
    { view: 'config' as const, label: 'Config' },
  ]
    .map(
      (l) =>
        `<a href="${buildUrl(basePath, { ...params, view: l.view })}"${params.view === l.view ? ' class="active"' : ''}>${l.label}</a>`
    )
    .join(' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - OpenStoat</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <nav>${navLinks}</nav>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function link(text: string, href: string): string {
  return `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
}
