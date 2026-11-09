import { createFixtureServer } from '../tests/support/fixtureServer.js';
import Position from '../server/models/Position.js';

const fixture = await createFixtureServer({ port: 4175, frontend: true, localization: process.argv.includes('--localization') });
if (process.argv.includes('--seed')) {
  await Position.create({ user: fixture.users[0]._id, symbol: 'AAPL', name: 'QA seeded holding', broker: 'QA', quantity: 3, averagePrice: 100, lots: [{ quantity: 3, price: 100, date: new Date('2026-01-02') }] });
  console.log('Seeded one synthetic holding for browser QA.');
}
if (process.argv.includes('--seed-partial')) {
  await Position.create([
    { user: fixture.users[0]._id, symbol: 'AAPL', name: 'QA known classification', quantity: 3, averagePrice: 100, lots: [{ quantity: 3, price: 100, date: new Date('2026-01-02') }] },
    { user: fixture.users[0]._id, symbol: 'QAUNKNOWN', name: 'QA missing classification', quantity: 1, averagePrice: 100, lots: [{ quantity: 1, price: 100, date: new Date('2026-01-02') }] },
  ]);
}
if (process.argv.includes('--seed-fund')) {
  await Position.create(['GOOG', 'MA', 'IVV'].map((symbol, index) => ({ user: fixture.users[0]._id, symbol, name: 'QA mixed fund portfolio', quantity: index === 2 ? 2 : 4, averagePrice: 100, lots: [{ quantity: index === 2 ? 2 : 4, price: 100, date: new Date('2026-01-02') }] })));
}
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
