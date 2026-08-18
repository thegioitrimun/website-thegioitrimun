# Brand Logo and Navbar Design

## Scope

- Replace the visible site logo, favicon, boot logo, PWA icons, and SEO logo with the supplied `logo.webp` artwork.
- Replace the two navbar labels with two lines: `Da Liễu Nhiệt Đới` and `Phú Quốc`.
- This decision was superseded by the site-wide `Thế Giới Trị Mụn` rebrand on 2026-06-19.

## Navbar Treatment

- Preserve the current rounded, bordered navbar structure and responsive behavior.
- Reduce the navbar background opacity to approximately 52-58%.
- Reduce backdrop blur to a light level while retaining enough contrast in light and dark themes.
- Keep the new two-line brand block compact enough for mobile without clipping navigation controls.

## Asset Strategy

- Store the supplied WebP as the canonical public logo asset.
- Generate the existing required PNG icon sizes from that source so favicon, PWA, boot screen, structured data, and browser icons remain compatible.
- Update shared default logo references rather than introducing page-specific overrides.

## Verification

- Build the production bundle.
- Verify desktop and mobile navbar rendering in light and dark themes.
- Verify favicon/boot logo paths return successfully.
- Check the browser console for asset or runtime errors.
