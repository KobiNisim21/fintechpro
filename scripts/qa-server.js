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
if (process.argv.includes('--seed-live-alerts')) {
  // Intentionally replay an old server's duplicate payload through real sockets.
  const now = Date.now();
  const feed = [2.4, 2.6, 2.3].map((value, index) => ({
    id: `qa-price-${index}`, type: 'gain', ticker: 'IVV', companyName: 'iShares S&P 500',
    message: `iShares S&P 500 up ${value}% today`, value,
    timestamp: new Date(now - index * 7200000).toISOString(), relativeTime: 'just now',
  }));
  feed.push({ id: 'qa-news', type: 'news', ticker: 'IVV', companyName: 'iShares S&P 500',
    message: 'QA: a separate IVV news headline', timestamp: new Date(now - 1).toISOString(), relativeTime: 'just now' });
  fixture.io.on('connection', socket => {
    socket.emit('live-alerts-init', { alerts: feed });
    socket.on('__qa-next-live-alert', () => {
      const alert = { ...feed[0], id: 'qa-price-updated', type: 'loss', value: -2.1,
        message: 'iShares S&P 500 down 2.1% today', timestamp: new Date().toISOString() };
      feed.unshift(alert);
      socket.emit('live-alert', { alert, allAlerts: feed });
    });
  });
}
if (process.argv.includes('--seed-market-news')) {
  // Populate all five pages, including ticker buttons, without external feeds.
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `qa-market-news-${index}`, source: 'QA Market Source',
    headline: `QA market headline ${String(index + 1).padStart(2, '0')}`,
    content: 'Synthetic market news for mobile pagination testing.',
    summary: 'Synthetic market news for mobile pagination testing.',
    tickers: [['IVV'], ['GOOG'], ['MA']][index % 3],
    pubDate: new Date(Date.now() - index * 3600000).toISOString(), relativeTime: 'just now',
  }));
  fixture.io.on('connection', socket => socket.emit('market-news-update', { items, newCount: 0 }));
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
