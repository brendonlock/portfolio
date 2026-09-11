# Brendon Lock — Portfolio

Personal portfolio: web development, mechanical engineering projects, and music.
Cape Town, South Africa.

Plain HTML, CSS, and JavaScript. No build step, no dependencies.
The design follows the style reference in `DESIGN_portfolio.md` (Switzer at weight 300,
Bone White canvas, sharp-cornered cards, pill-shaped controls) with a light/dark toggle
and scroll effects: line-split headline reveals, parallax media, a scroll progress hairline,
and a curtain menu.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Structure

- `index.html` — page content
- `styles.css` — design tokens and layout; semantic colour tokens at the top drive both themes
- `script.js` — scroll effects, menu, theme toggle, carousel
- `images/` — photos used on the site

Built with Claude Code from a written design system.
