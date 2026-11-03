---
name: quayzen-design
description: Quayzen visual system with exact colours, four theme modes, icon packs, logos, artifact CSS classes and layout rules. Use before creating or changing any screen or component.
---

# Quayzen design

Colours and icons must match the artifact **exactly**. Layout and flow are visual direction only.

## Source of truth
- `apps/web/src/styles/artifact.css` is the artifact's CSS, verbatim. **Do not edit it, and do not restate colours as hex.** It references illustrations and icons by relative path, so `src/styles/art` and `src/styles/icons*` hold copies under the artifact's names; keep them. Fixes and additions go in `src/styles/quayzen.css`, loaded after it.
- Tailwind uses the same tokens through `@theme inline` in `src/app/globals.css`: `bg-panel`, `bg-soft`, `text-ink`, `text-muted`, `border-line`, `text-brand`, `bg-brand`, and so on. Never use default Tailwind palette colours.
- Screens to compare against: `docs/Quayzen-design-kit.zip`, under `layouts/`.

## Four modes = 2 looks x 2 themes
Attributes on `<html>`: `data-look="pencil"|"pro"`, `data-theme="light"|"dark"`, `data-dark="0"|"1"`. Set on the server from the `qz_look` and `qz_theme` cookies, and a small script in `app/layout.tsx` resolves "system" before paint. Use `useTheme()` from `components/theme.tsx`.
- Pencil: white or dark flat surfaces, hand-drawn icons, sketch illustrations.
- Professional: liquid glass on a soft gradient, iOS-style icon tiles.

## Assets (`apps/web/public`)
- `icons/{pencil-light,pencil-dark,professional-light,professional-dark}/<name>.svg`. Always use `<Pic name=.. />`, which chooses the pack. 32 names: apply ask auto bplan budget changes checklists company comply dashboard develop documents docx download howto investment library menu moon obligations offices operations pdf quayza reports requests returns setup sun visas workforce xlsx.
- `logo/`, `illustrations/` (colombo-skyline, sez-waterfront; each -light and -dark). Phosphor is MIT and Kalam is OFL, so keep `icons/LICENSE-phosphor.txt`.
- Fonts: Google Sans, falling back to Poppins, for the interface; Space Grotesk for the Professional wordmark; Patrick Hand for Pencil accents.

## Shell and classes
Markup: `<div class="mainwrap"><div class="topbar">…</div><main>…</main></div><nav class="dock">…</nav>`.
Common classes: `hero`, `stats`, `stat`, `sic`, `cols`, `card`, `rem`, `badge bad|warn|info|ok`, `btn p|sm|bad`, `banner bad|warn|demo|info`, `tab`, `dk-btn`, `dk-panel`, `dk-item`, `fld`, `chatwrap`, `msg`, `askbar`, `chip-btn`, `cite`.
To see a class in use, search `docs/artifact/src/` (for example `app.js` for the dock, `pages1.js` for the dashboard).

## Screenshot flaws that must NOT be copied
1. "Not saved. Open in claude.ai" banner: artifact-only, never show it.
2. Bottom dock covering content: `main` keeps enough bottom padding to scroll clear of the dock.
3. Professional background gradient ending abruptly on long pages: `html[data-look=pro] body` gets `background-attachment: fixed`.
4. Sign-in demo buttons and "Create company": replaced by email and password.

## Product name
UI label is "Ask Quayza" and the icon is `quayza`, as in the artifact. The label lives in one constant (`ASSISTANT_NAME` in `src/lib/sections.ts`; the service has `NAME` in `services/ai/app/chat.py`).
