# PWA (Progressive Web App)

ViewBait is installable as a PWA so users can add it to their home screen. The app icon and splash look use the ViewBait logo and CRT-style branding (dark background, red accent).

## Manifest and icons

- **Manifest**: `app/manifest.ts` defines the web app manifest (name, short_name, icons, theme_color, background_color, display, start_url). Next.js serves it and links it automatically.
- **Icons**: PWA icons (192×192, 512×512, and 512×512 maskable) live in `public/icons/`. They are generated from the ViewBait logo SVG (same as `app/icon.svg` and `components/ui/viewbait-logo.tsx`).
- **Theme / background**: `theme_color` is `#b91c3c` (logo red); `background_color` is `#0a0a0a` (CRT dark / brand background). These match the CRT loading effect and brand identity.

## Regenerating icons

If the logo changes, regenerate PWA icons with:

```bash
node scripts/generate-pwa-icons.js
```

This script (using `sharp`) writes:

- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`
- `public/icons/icon-512x512-maskable.png` (logo centered on `#0a0a0a` for Android maskable)
- `app/apple-icon.png` (180×180 for iOS)

Commit the updated PNGs after running the script.

## Service worker

A minimal service worker at `public/sw.js` is registered on the client via `components/pwa-register.tsx` (included in `app/providers.tsx`). It does not cache; it only enables installability on browsers that require a SW (e.g. Chrome on Android). `next.config.ts` sets no-cache headers for `/sw.js`.

## Testing

- Serve over HTTPS (required for PWA install).
- In Chrome DevTools → Application → Manifest, confirm name, icons, theme_color, and background_color.
- Use “Add to Home Screen” (or Install) and verify the icon and splash background match the logo and CRT style.
