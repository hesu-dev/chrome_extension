# Firefox Source Submission README

This source package is provided for Mozilla AMO review of the self-distributed Android add-on build.

## Exact Source Inputs

The uploaded add-on package is built from these sibling folders in the same repository root:

- `R20-JSONExporter`
- `R20-JSONExporter-firefox-mobile`
- `roll20-json-core`

`R20-JSONExporter` contains the release build scripts.
`R20-JSONExporter-firefox-mobile` contains the Android-targeted extension source.
`roll20-json-core` contains the shared parsing source that is bundled into the staged release output as `js/vendor/roll20-json-core.js`.

## Operating System and Build Environment

The attached release packages were generated on:

- macOS
- zsh shell
- Node.js `v23.7.0`
- npm `10.9.2`
- system `zip` CLI available on `PATH`

The build scripts use only Node.js built-in modules plus the operating system `zip` utility. No transpiler, minifier, or webpack-style bundler is used.

## Program Installation Requirements

Install the following programs before running the build:

1. Node.js `23.7.0`
2. npm `10.9.2` (bundled with the Node.js install above)
3. A `zip` command-line utility available on `PATH`

After installation, confirm:

```bash
node -v
npm -v
zip -v
```

## Step-by-Step Build Instructions

1. Extract this source package so these folders remain siblings under one repository root:
   - `R20-JSONExporter`
   - `R20-JSONExporter-firefox-mobile`
   - `roll20-json-core`
2. Open a shell in `R20-JSONExporter`.
3. Run:

```bash
npm run build
npm run zip
```

4. The Firefox add-on package submitted to AMO is produced at:

```bash
R20-JSONExporter/release/firefox-mobile.zip
```

The combined release command below produces the same output:

```bash
./deploy.sh
```

## Notes for Review

- Source files are stored in readable form in the folders listed above.
- Generated release artifacts under any `release/` directory are excluded from this source package.
- The Firefox package uses `browser_specific_settings.gecko.id = r20-json-exporter-firefox@reha.dev`.
