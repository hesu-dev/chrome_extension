# Release Targets

## Layout

- `R20-JSONExporter`: Chrome source project
- `R20-JSONExporter-firefox-mobile`: Firefox for Android source project
- `roll20-json-core`: shared parsing and JSON-building core
- `R20-JSONExporter/release/chrome`: staged Chrome Web Store artifact
- `R20-JSONExporter/release/firefox-mobile`: staged Firefox Android artifact
- `R20-JSONExporter/release/ios-safari`: reserved iOS Safari handoff folder

## Packaging Rule

Do not zip source folders directly anymore.

- Chrome uploads must come from `release/chrome`
- Firefox self-distribution packages must come from `release/firefox-mobile`

Each release folder must be self-contained, including the bundled shared core.

## Shared Core Rule

Parser rules and chat JSON builders live in `roll20-json-core`.

- Add new parsing rules there first.
- Rebuild release targets after shared-core changes.
- Do not manually copy parser rules between Chrome and Firefox targets.

## iOS Handoff

`release/ios-safari` is a reserved documentation and staging folder for the future Safari Web Extension embedded in the Flutter iOS app.

The planned inbox contract is:

1. Safari extension exports JSON into an App Group inbox directory.
2. The Flutter iOS app imports that JSON into its internal store on foreground or launch.
3. After a successful import, the app deletes the source file from the App Group inbox immediately.
