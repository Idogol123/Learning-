# file-search — build sources

`../file-search.html` and `../index.html` are **generated**. Do not hand-edit them;
edit `template.html` here and rebuild.

## Build

```bash
cd src
npm install          # fetches xlsx, mammoth, pdfjs-dist (see package.json)
node build.mjs       # writes ../file-search.html and ../index.html
```

The build inlines the three parsing libraries and the PDF worker (as a base64
data: URI) plus the home-screen icon, producing one ~3.3 MB self-contained,
fully-offline HTML file. `index.html` is identical and is what GitHub Pages
serves at the site root.

## Files

- `template.html` — all app HTML/CSS/JS (the only file you normally edit). The
  `<!--LIBS-->` and `<!--ICON-->` markers are where the build injects assets.
- `build.mjs` — the inliner.
- `icon.png` — 512×512 home-screen / apple-touch icon.

## Notes / gotchas

- The library injection uses a replacement **function** so `$`-sequences inside
  the minified code aren't interpreted; minified text is also sanitized for any
  literal `</script`.
- PDF parsing rebuilds the page layout from glyph coordinates (roster support):
  rows are clustered by y (±3px), sorted right-to-left for Hebrew, and header
  levels are inferred by font height (day / task) plus lone right-column labels
  (position).
- Matching uses a nikkud/whitespace-tolerant regex that also drives highlighting.

## Deploy

Push to branch `claude/file-search-app-6cqze4`; GitHub Pages auto-deploys to
`https://idogol123.github.io/Learning-/`.
