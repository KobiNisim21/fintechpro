import { createFixtureServer } from '../tests/support/fixtureServer.js';

const fixture = await createFixtureServer({ port: 4175, frontend: true });
console.log(`Disposable local QA: ${fixture.baseUrl}/__qa/login/one`);
console.log('Second fixture user: /__qa/login/two. No production data or external providers are used.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await fixture.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
