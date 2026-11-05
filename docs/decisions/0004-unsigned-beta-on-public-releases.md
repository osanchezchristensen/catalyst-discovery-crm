# ADR 0004: Unsigned beta through public GitHub Releases

- **Status:** Accepted
- **Date:** 2026-11-03

## Context
The app is ready for its first cohort. Students need a way to download installers, and the PRD's open question about KU signing certificates (Apple Developer ID and a Windows code-signing certificate) isn't answered yet. Unsigned builds still install, but Windows SmartScreen and macOS Gatekeeper warn on first launch.

## Decision
Ship **v0.9.0 as an unsigned beta**. A GitHub Actions workflow builds the Windows, macOS and Linux installers when a `v*` tag is pushed and puts them in a **draft** GitHub Release, which a person reviews and publishes. The repository is **public**, so students download from the Releases page. A student install guide (`docs/guides/install-guide.md`) walks through the first-launch warnings.

## Consequences
- Students see a one-time security warning, and the install guide has to stay accurate.
- The source code is public. Nothing secret is in the repo; history was scanned before going public.
- Electron fuses still protect the packaged app, but the macOS hardened runtime and notarization are off until a Developer ID exists.
- Signing later is a configuration change: add the certificate secrets to the repo, pass them to the packaging step in `.github/workflows/release.yml`, and turn `mac.hardenedRuntime` back on. Bump to 1.0.0 then.
- The macOS universal build with better-sqlite3 prebuilds is only verified by the first tagged run. If it fails, ship separate x64 and arm64 dmgs.

## Alternatives considered
- **Wait for KU certificates:** delays the pilot for an unknown time.
- **Private repo, share installers through KU Box:** keeps the code private but adds a manual step for every release. The owner chose public releases.
