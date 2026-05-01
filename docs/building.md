# Building & Distribution

How to build, version, package, and ship OopsTab.

---

## Local Development

```bash
npm install         # one-time / after dep changes
npm run dev         # webpack --watch, source maps on, dev mode
npm run build       # production webpack + zip-extension
npm run lint        # eslint . --ext .ts,.tsx
```

`npm run dev` watches `src/`, rebuilds on save into `dist/`. No HMR (browser extensions can't use it usefully) — reload the extension manually in `chrome://extensions` after a rebuild to pick up changes.

`npm run build` runs the production webpack config (no source maps, tree-shaking on, `process.env.NODE_ENV === "production"` so `DebugPanel` is dropped) and then invokes `scripts/tools/zip-extension.js` to package the result.

### Loading the dev build into Chrome

1. `npm run dev` (or `npm run build` for a one-shot prod build).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the `dist/` directory.
6. The extension is now installed. After every rebuild, hit the **reload** icon on the OopsTab card.

---

## Build Artifacts

### `dist/` — Unpacked Extension

Webpack output. Loadable directly via "Load unpacked". Layout:

```
dist/
├── manifest.json              ← copied from public/
├── background.js              ← src/background/index.ts → bundled
├── content.js                 ← src/content/index.ts → bundled
├── oopstab.html + oopstab.js  ← src/pages/oopstab/ entry
├── options.html + options.js  ← src/options/ entry
├── middleware-tab.html        ← copied from src/
├── middleware-tab.js          ← copied from src/
├── icons/                     ← copied from public/icons/
└── assets/                    ← copied from public/assets/ (if exists)
```

`dist/` is wiped on every build (`output.clean: true`).

### `builds/<name>-<version>.zip` — Distribution Package

Produced by `scripts/tools/zip-extension.js` after `npm run build`. Reads the version straight from `dist/manifest.json` so the zip name always matches the manifest. Compression level 9. Example: `builds/OopsTab.Never.Lose.Your.Tabs.Again-1.0.6.zip`.

This is the file you upload to the Chrome Web Store and that the GitHub release workflow attaches to a release.

---

## Versioning

`scripts/tools/version-update.js <level>` keeps `package.json`, `public/manifest.json`, and the git tag in sync.

| Level | Bump | Use case |
|---|---|---|
| `0` | none — tag only | Re-tag the current version (rare, for hotfix re-runs) |
| `1` | patch (x.y.**z**) | Bug fixes, minor copy edits, no schema change |
| `2` | minor (x.**y**.0) | New user-visible feature |
| `3` | major (**x**.0.0) | Breaking change to the data shape or core flow |

What it does (levels 1-3):

1. Reads current version from `public/manifest.json`.
2. Increments per the level, syncs both `manifest.json` and `package.json`.
3. **Auto-commits** with message `Bump version to <newVersion>`.
4. Creates an annotated git tag `v<newVersion>`.
5. Stops — does **not** push. You push manually:
   ```bash
   git push
   git push origin --tags
   ```

Pushing the tag triggers the release workflow.

```bash
node scripts/tools/version-update.js 1   # patch
node scripts/tools/version-update.js 2   # minor
node scripts/tools/version-update.js 3   # major
node scripts/tools/version-update.js 0   # tag the current version only
```

> **Caution:** `version-update.js` runs `git add public/manifest.json package.json && git commit` before tagging. Don't run it with unrelated staged changes — they'll get pulled into the version-bump commit.

---

## Release Pipeline (GitHub Actions)

`.github/workflows/release.yml` — triggers on push of any `v*` tag.

```
push tag v*
  → checkout (LFS, full history)
  → setup Node 18
  → npm ci
  → npm run build
  → softprops/action-gh-release publishes builds/*.zip as a public GH release
    with auto-generated release notes
```

Permissions: `contents: write` (creates the release).

The release is **public** the moment the workflow finishes. There's no draft / review step.

### Cutting a Release Manually

```bash
# 1. Make sure main is clean
git status

# 2. Bump version (commits + tags)
node scripts/tools/version-update.js 1

# 3. Push the commit + tag
git push
git push origin --tags

# 4. Watch the workflow
#    → https://github.com/RockyHong/OopsTab/actions

# 5. After the workflow succeeds, the release exists at:
#    → https://github.com/RockyHong/OopsTab/releases/latest
```

---

## Chrome Web Store Upload (Manual)

Web Store upload is **not** automated. After the GH release succeeds:

1. Download `builds/<name>-<version>.zip` from the release page.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Open the OopsTab listing.
4. **Package** → **Upload new package** → select the zip.
5. Save & **Submit for review**. Review takes anywhere from minutes to several days.

Why not automated: the Web Store API requires OAuth + service-account setup that isn't worth the friction at solo-dev release cadence. If release cadence ever picks up, revisit.

---

## Pre-Release Cleanup (Optional)

`scripts/tools/clean-console-logs.js` strips `console.log` statements from the source tree. Run before a release if you want a quieter production build:

```bash
node scripts/tools/clean-console-logs.js
```

Not part of `npm run build` — invoke explicitly. Errors and warnings (`console.error`, `console.warn`) are preserved; they're load-bearing for service-worker debugging in production.

---

## Reference: File Map

| File | Role |
|---|---|
| `webpack.config.js` | Multi-entry build (background, content, oopstab, options) + asset copy |
| `tsconfig.json` | TS 5, strict, ES6 target, react-jsx |
| `tailwind.config.js` | Theme tokens (palette, typography, spacing, radius) |
| `postcss.config.js` / `.postcssrc` | PostCSS plugins (tailwindcss + autoprefixer) |
| `.eslintrc.js` | ESLint 9 (legacy config, not flat) |
| `public/manifest.json` | Source of truth for extension version + permissions |
| `package.json` | Synced with manifest version on bump |
| `scripts/tools/zip-extension.js` | Packages `dist/` into `builds/<name>-<version>.zip` |
| `scripts/tools/version-update.js` | Bumps version + commits + tags |
| `scripts/tools/clean-console-logs.js` | Strips `console.log` from source |
| `.github/workflows/release.yml` | On `v*` tag → build → GH release with zip |
