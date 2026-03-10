# iOS Safari Release Placeholder

Reserved for future Safari Web Extension release artifacts bundled with the Flutter iOS app.

## Planned Contract

- The Safari Web Extension will export Roll20 chat JSON into an App Group inbox directory.
- The Flutter iOS app will import that JSON into its internal storage when the app returns to the foreground or launches.
- After a successful import, the Flutter app must delete the source JSON file from the App Group inbox immediately so the shared container does not grow without bound.
