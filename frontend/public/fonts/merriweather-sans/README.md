# Merriweather Sans Font

This directory contains self-hosted Merriweather Sans font files for the Tadka news portal.

## Font Details

- **Font Family:** Merriweather Sans
- **Type:** Sans-serif
- **Designer:** Sorkin Type
- **Weights Available:** 300 (Light), 400 (Regular), 700 (Bold), 800 (Extra Bold)
- **Styles:** Normal and Italic for each weight

## Why Self-Hosted?

Self-hosting fonts provides several benefits:
1. **Performance:** Faster load times by serving fonts from the same origin
2. **Reliability:** No dependency on external CDNs like Google Fonts
3. **Privacy:** No external requests that could track users
4. **Offline Support:** Fonts work even without internet connectivity

## Font Files

The font files are organized by weight and style:
- `merriweather-sans-v28-latin-300.*` - Light (300)
- `merriweather-sans-v28-latin-300italic.*` - Light Italic
- `merriweather-sans-v28-latin-regular.*` - Regular (400)
- `merriweather-sans-v28-latin-italic.*` - Regular Italic
- `merriweather-sans-v28-latin-700.*` - Bold (700)
- `merriweather-sans-v28-latin-700italic.*` - Bold Italic
- `merriweather-sans-v28-latin-800.*` - Extra Bold (800)
- `merriweather-sans-v28-latin-800italic.*` - Extra Bold Italic

Multiple formats are provided for maximum browser compatibility:
- `.woff2` - Modern browsers (smallest file size, best performance)
- `.woff` - Older browser support
- `.ttf` - Fallback for very old browsers

## Usage

The fonts are loaded via `@font-face` declarations in `/app/frontend/public/fonts/fonts.css` and configured as the default font family in Tailwind configuration.

## License

Merriweather Sans is licensed under the SIL Open Font License 1.1.
