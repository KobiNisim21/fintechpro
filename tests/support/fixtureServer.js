import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { Server } from 'socket.io';
import User from '../../server/models/User.js';
import Position from '../../server/models/Position.js';
import { protect } from '../../server/middleware/auth.js';
import { createAddPosition, getPositions, updatePosition, deletePosition } from '../../server/controllers/positionsController.js';
import activityRoutes from '../../server/routes/activity.js';
import { createAlertRoutes } from '../../server/routes/alerts.js';
import { calculatePortfolioRisk, combinePositions, buildDividendEstimate } from '../../server/services/portfolioRisk.js';
import { readFileSync } from 'node:fs';
import { createProfileResolver, createHoldingsReference } from '../../server/services/sectorClassification.js';
import { createFundResolver } from '../../server/services/fundExposure.js';

const fixtureProfile = createProfileResolver({
  fund: createFundResolver({ snapshots: JSON.parse(readFileSync(new URL('../../server/data/fund-exposure-reference.json', import.meta.url))), download: async () => { throw new Error('No network in fixture'); } }),
  finnhub: async () => ({}), yahoo: async () => ({}),
  reference: createHoldingsReference({ snapshot: JSON.parse(readFileSync(new URL('../../server/data/equity-sector-reference.json', import.meta.url))), download: async () => { throw new Error('No network in fixture'); } }),
});

const securities = [
  { symbol: 'AAPL', displaySymbol: 'AAPL', description: 'QA Apple fixture' },
  { symbol: 'MSFT', displaySymbol: 'MSFT', description: 'QA Microsoft fixture' },
];

export async function fixtureQuote(symbol) {
  const security = securities.find(item => item.symbol === symbol);
  if (!security) throw new Error('Unknown fixture symbol');
  return { c: 150, pc: 149, d: 1, dp: 100 / 149, name: security.description, source: 'QA fixture', t: Math.floor(Date.now() / 1000) };
}

export async function createFixtureServer({ port = 0, frontend = false } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('QA fixture server cannot run in production');
  // No .env, production connection string or provider credentials are read.
  const mongod = await MongoMemoryServer.create({
    binary: { downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries/', import.meta.url)) },
    instance: { ip: '127.0.0.1', dbName: 'traderai_disposable_qa' },
  });
  const secret = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = secret;
  let server, io, vite;
  const close = async () => {
    await vite?.close();
    if (io) await new Promise(resolve => io.close(resolve));
    server?.closeAllConnections();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  };
  try {
    await mongoose.connect(mongod.getUri(), { dbName: 'traderai_disposable_qa' });
    await Promise.all([User.init(), Position.init()]);
    const users = await User.create([
      { name: 'QA One', email: 'qa-one@example.test' },
      { name: 'QA Two', email: 'qa-two@example.test' },
    ]);
    const tokens = users.map(user => jwt.sign({ id: user._id }, secret, { expiresIn: '1h' }));
    const app = express();
    let failedPositionReads = 0;
    app.use(express.json());
    app.use('/api/activity', activityRoutes);
    app.use('/api/alerts', createAlertRoutes(fixtureQuote));
    app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });
    app.get('/api/positions', protect, (req, res, next) => {
      if (failedPositionReads > 0) {
        failedPositionReads--;
        return res.status(503).json({ message: 'Intentional QA outage' });
      }
      next();
    }, getPositions);
    app.post('/api/positions', protect, createAddPosition(fixtureQuote));
    app.put('/api/positions/:id', protect, updatePosition);
    app.delete('/api/positions/:id', protect, deletePosition);
    app.get('/api/auth/me', protect, (req, res) => res.json(req.user));
    app.get('/api/watchlist', protect, (req, res) => res.json([]));
    app.get('/api/stocks/search', protect, (req, res) => res.json(securities.filter(s => `${s.symbol} ${s.description}`.toLowerCase().includes(String(req.query.q || '').toLowerCase()))));
    app.get('/api/stocks/forex/usd-ils', protect, (req, res) => res.json({ rate: 3.5, source: 'QA fixture' }));
    app.get('/api/stocks/batch-extended-quote', protect, (req, res) => res.json(Object.fromEntries(String(req.query.symbols || '').split(',').filter(Boolean).map(symbol => [symbol, {
      symbol, regularMarketPrice: 150, regularMarketPreviousClose: 149, regularMarketChange: 1,
      regularMarketChangePercent: 100 / 149, regularMarketTime: Math.floor(Date.now() / 1000),
      source: 'QA fixture', marketState: 'CLOSED', currency: 'USD',
    }]))));
    app.get('/api/stocks/batch-history', protect, (req, res) => res.json(Object.fromEntries(String(req.query.symbols || '').split(',').filter(Boolean).map(symbol => [symbol, {
      c: [148, 149, 150], t: [2, 1, 0].map(days => Math.floor(Date.now() / 1000) - days * 86400), s: 'ok', currency: 'USD',
    }]))));
    app.get('/api/stocks/batch-insights', protect, async (req, res) => res.json({
      recommendations: {}, priceTargets: {}, profiles: Object.fromEntries(await Promise.all(String(req.query.symbols || '').split(',').filter(Boolean).map(async symbol => [symbol, await fixtureProfile(symbol)]))),
    }));
    app.get('/api/stocks/portfolio-analytics', protect, async (req, res) => {
      const positions = combinePositions(await Position.find({ user: req.user._id, isDeleted: { $ne: true } }).lean());
      const rows = await Promise.all(positions.map(async p => { const profile = await fixtureProfile(p.symbol); return { symbol: p.symbol, value: p.quantity * 150, sector: profile.sector, classification: profile.classification, fundExposure: profile.fundExposure, country: profile.country, currency: profile.currency, beta: 1 }; }));
      const risk = calculatePortfolioRisk(rows);
      const exDate = new Date(Date.now() + 10 * 86400000).toISOString(), paymentDate = new Date(Date.now() + 20 * 86400000).toISOString();
      res.json({ ...risk, quoteCoverage: true, benchmarkData: [], dividends: positions.map(p => ({ ...buildDividendEstimate(p.symbol, positions, { exDate, paymentDate, amount: 0.5 }), source: 'QA fixture' })), correlationMatrix: { symbols: [], matrix: [] }, lastUpdated: new Date().toISOString() });
    });
    app.get('/api/stocks/:symbol/quote', protect, async (req, res) => {
      try { res.json(await fixtureQuote(req.params.symbol)); }
      catch { res.status(404).json({ message: 'Unknown fixture symbol' }); }
    });

    // This helper exists only in the loopback fixture server, never in production.
    app.get('/__qa/login/:user', (req, res) => {
      const index = req.params.user === 'one' ? 0 : req.params.user === 'two' ? 1 : -1;
      if (index < 0) return res.sendStatus(404);
      const user = users[index];
      const data = JSON.stringify({ _id: String(user._id), name: user.name, email: user.email });
      res.type('html').send(`<!doctype html><title>Disposable QA session</title><script>localStorage.setItem('token',${JSON.stringify(tokens[index])});localStorage.setItem('user',${JSON.stringify(data)});location.replace('/');</script>`);
    });
    app.get('/__qa/state', async (req, res) => res.json({
      environment: 'disposable-local-qa', database: mongoose.connection.name,
      positions: await Position.countDocuments(),
      connections: io.sockets.sockets.size,
      subscriptions: [...new Set([...io.sockets.sockets.values()].flatMap(socket => socket.data.symbols || []))],
    }));
    app.post('/__qa/fail-next-read', (req, res) => {
      failedPositionReads = 1;
      res.json({ nextPositionReadFails: true });
    });
    server = createServer(app);
    io = new Server(server);
    io.use(async (socket, next) => {
      try {
        const decoded = jwt.verify(socket.handshake.auth?.token, secret);
        if (!await User.exists({ _id: decoded.id })) throw new Error('Unknown fixture user');
        next();
      } catch { next(new Error('Fixture authentication required')); }
    });
    io.on('connection', socket => {
      socket.on('subscribe-prices', data => { socket.data.symbols = data?.symbols || []; });
      socket.on('unsubscribe-prices', data => {
        socket.data.symbols = (socket.data.symbols || []).filter(s => !(data?.symbols || []).includes(s));
      });
      socket.emit('live-alerts-init', { alerts: [] });
      socket.emit('market-news-update', { items: [], newCount: 0 });
    });
    app.post('/__qa/disconnect', (req, res) => {
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
      res.json({ disconnected: true });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    if (frontend) {
      const { createServer: createViteServer } = await import('vite');
      const react = (await import('@vitejs/plugin-react-swc')).default;
      const tailwind = (await import('@tailwindcss/vite')).default;
      vite = await createViteServer({
        configFile: false, envDir: false,
        root: fileURLToPath(new URL('../../', import.meta.url)),
        plugins: [react(), tailwind()],
        resolve: { alias: { '@': fileURLToPath(new URL('../../src/', import.meta.url)) } },
        define: {
          'import.meta.env.VITE_API_URL': JSON.stringify(baseUrl),
          'import.meta.env.VITE_SOCKET_URL': JSON.stringify(baseUrl),
          'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(''),
        },
        server: { middlewareMode: true, hmr: false },
      });
      app.use(vite.middlewares);
    }
    return { baseUrl, tokens, users, io, close };
  } catch (error) {
    await close();
    throw error;
  }
}
