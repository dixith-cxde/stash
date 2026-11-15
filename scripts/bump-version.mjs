#!/usr/bin/env node
/**
 * Bumps the app version everywhere it lives: app.json `expo.version` + `android.versionCode`
 * (always +1, Android refuses to install a lower code over a higher one) and package.json.
 *   npm run version:bump            → patch (1.0.5 → 1.0.6)
 *   npm run version:bump -- minor   → 1.1.0
 *   npm run version:bump -- 2.0.0   → exact version
 * Then commit, tag `vX.Y.Z`, build the release APK and attach it to a GitHub release named
 * after the tag: the app's "Check for updates" reads the latest release and its .apk asset.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2] ?? 'patch';
const appPath = new URL('../app.json', import.meta.url);
const pkgPath = new URL('../package.json', import.meta.url);
const app = JSON.parse(readFileSync(appPath, 'utf8'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const [major, minor, patch] = app.expo.version.split('.').map(Number);
const next =
  arg === 'major' ? `${major + 1}.0.0`
  : arg === 'minor' ? `${major}.${minor + 1}.0`
  : arg === 'patch' ? `${major}.${minor}.${patch + 1}`
  : /^\d+\.\d+\.\d+$/.test(arg) ? arg
  : null;
if (!next) {
  console.error(`Unknown bump "${arg}": use patch, minor, major or an exact x.y.z`);
  process.exit(1);
}

const code = (app.expo.android.versionCode ?? 0) + 1;
app.expo.version = next;
app.expo.android.versionCode = code;
pkg.version = next;
writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version ${next} (versionCode ${code}). Next: git commit, git tag v${next}, build, gh release create v${next} <apk>`);
