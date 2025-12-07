# Inter Font - Self Hosted

## Version
Inter v4.0

## License
Inter is licensed under the SIL Open Font License 1.1
See LICENSE.txt for full details

## Source
Downloaded from: https://github.com/rsms/inter

## Files Structure

- **InterVariable.ttf** - Variable font (all weights 100-900) - 843KB
- **InterVariable-Italic.ttf** - Variable italic font - 874KB
- **web/** - Individual weight files in woff2 format (browser fallback)

## Usage

The font is automatically loaded via `/src/fonts.css` which is imported in `/src/index.css`

## Benefits of Self-Hosting

1. **Performance** - No external DNS lookup, faster loading
2. **Privacy** - No tracking or data sent to Google
3. **Reliability** - Works offline, no dependency on external CDN
4. **Control** - Full control over font loading and caching

## Font Weights Available

- 100 - Thin
- 200 - Extra Light
- 300 - Light
- 400 - Regular (default)
- 500 - Medium
- 600 - Semi Bold
- 700 - Bold
- 800 - Extra Bold
- 900 - Black

## File Sizes

- Variable fonts: ~850KB each (supports all weights)
- woff2 files: ~110KB each
- Total: ~15MB (includes extras folder)
- Production: Only ~1.7MB loaded (variable font + fallbacks)
