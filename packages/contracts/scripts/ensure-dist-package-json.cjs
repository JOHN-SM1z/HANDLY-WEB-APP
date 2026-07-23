// This package's own package.json is "type": "module" (its exports map's
// "import" condition points at raw ESM-syntax src/*.ts, consumed directly by
// Next.js via transpilePackages). But apps/api (NestJS) requires the
// *compiled* dist/index.js via the "require" condition, and tsc compiles
// that output as genuine CommonJS (tsconfig.json's "module": "CommonJS").
// Without this file, dist/*.js would inherit the outer "type": "module" and
// Node would refuse to `require()` them. Node's own documented pattern for
// dual CJS/ESM packages is a directory-scoped package.json that overrides
// the module format for everything under it — see
// https://nodejs.org/api/packages.html#dual-commonjses-module-packages.
// dist/ is gitignored and fully regenerated on every build/dev run, so this
// script (re)creates the marker on every invocation rather than checking it
// into git.
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
