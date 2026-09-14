#!/usr/bin/env node
try {
  const { main } = await import('../dist/cli.js');
  process.exitCode = await main();
} catch (cause) {
  console.error(`Merge driver infrastructure failure: ${String(cause)}`);
  process.exitCode = 130;
}
