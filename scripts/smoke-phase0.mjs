import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assertExists(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${relPath}`);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertContains(relPath, needle) {
  const content = read(relPath);
  if (!content.includes(needle)) {
    throw new Error(`Expected text not found in ${relPath}: ${needle}`);
  }
}

function run() {
  // Phase 0 docs
  assertExists('docs/adr/0001-content-architecture-direction.md');
  assertExists('docs/content-id-conventions.md');
  assertExists('src/game/content/adapters/README.md');

  // Core runtime files still present (basic startup/run-loop smoke prerequisite)
  assertExists('src/game/GameEngine.js');
  assertExists('src/game/Renderer.js');
  assertExists('src/game/CollisionSystem.js');
  assertExists('src/main.jsx');

  // Ensure app still instantiates GameEngine through the normal path
  assertContains('src/App.jsx', 'new GameEngine(');

  console.log('Phase 0 smoke checks passed.');
}

run();
