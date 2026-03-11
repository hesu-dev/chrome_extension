# Release Zip Cleanup and Mobile Testing Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure release zips are recreated cleanly so stale files cannot survive between builds, then document the correct Android Firefox and Safari testing order.

**Architecture:** Keep the existing release staging flow, but move zip creation behind a small helper that deletes any previous archive before rebuilding it. Validate behavior with a failing test that reproduces stale zip entries. Separately, verify Safari macOS testing availability and summarize Android and Safari test sequences from official docs.

**Tech Stack:** Node.js, `node:test`, shell `zip`/`unzip`, Chrome/Firefox release scripts, official Mozilla and Apple documentation.

---

### Task 1: Add a failing release-zip recreation test
### Task 2: Refactor zip creation so archives are deleted before rebuild
### Task 3: Re-run release tests and deploy locally
### Task 4: Verify and summarize Android Firefox and Safari testing order
