# Mayukhjit Chakraborty — Portfolio

Live site: https://mayukhjitchakraborty.is-a.dev/

## Overview

Single-page, minimalist, high‑performance developer portfolio. Built with semantic HTML, modern CSS, and vanilla JS animations. Features:

- Typewriter hero with flame/glow effects (reduced‑motion aware)
- Themed ambient canvas effects with buttery crossfades
- Smooth, accessible navigation and command palette
- Responsive layout for phones, desktop, and TVs/large displays
- Performance adaptations (adaptive DPR/particles, color caching)
- SEO/Open Graph/Twitter metadata and dynamic favicon

## Local development

No build required. Open `index.html` in a browser. For best results, serve over a local server:

```bash
# Python
python -m http.server 8080
# Or Node
npx http-server -p 8080
```

Then visit http://localhost:8080

## Deployment

Static hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages) — just publish the repository root. Ensure these assets exist at the site root:

- `/og.png` (Open Graph image)
- `/favicon.ico`, `/favicon-32x32.png`, `/favicon-16x16.png`
- `/apple-touch-icon.png`, `/safari-pinned-tab.svg`, `/site.webmanifest`

The app also generates a dynamic favicon at runtime to match the current theme.

## Accessibility

- Keyboard‑navigable cards (arrow keys + Enter)
- Focus styles and `aria` attributes for interactive elements
- Reduced‑motion support (prefers‑reduced‑motion)

## Customization

Use the command palette (Cmd/Ctrl+K) to tweak:

- Ambient glow strength
- Grid highlight intensity
- Toggle visual effects
- Theme rotation speed

## License

Copyright © Mayukhjit Chakraborty. All rights reserved.


