import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

/**
 * Builds the package a reviewer would install, and proves it by installing it.
 *
 * The ZIP is what gets submitted, so it is what gets smoke-tested: a packaging mistake
 * is invisible in the build directory and obvious the moment someone unpacks it.
 */
const OUT = '.output/package';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execFileSync('zip', ['-qr', `${process.cwd()}/${OUT}/tweakpage.zip`, '.'], {
  cwd: '.output/chrome-mv3',
  stdio: 'inherit',
});
execFileSync('unzip', ['-q', `${OUT}/tweakpage.zip`, '-d', `${OUT}/unpacked`], { stdio: 'inherit' });
execFileSync('npx', ['playwright', 'test', '--config', 'playwright.shots.config.ts', '-g', 'unzipped package'], {
  stdio: 'inherit',
  env: { ...process.env, TWEAKPAGE_PACKAGE: `${process.cwd()}/${OUT}/unpacked` },
});
console.log(`\nPackage ready: ${OUT}/tweakpage.zip`);
