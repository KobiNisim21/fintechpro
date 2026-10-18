import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import ApiKey from '../models/ApiKey.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';
import { 
    createMcpServer, 
    getPortfolioMetrics, 
    getPortfolioNews, 
    getWatchlistItems,
    getTransactions,
    addOrUpdatePosition,
    sellPosition,
    removePosition,
    updatePositionHolding,
    importPositions,
    updateCashBalance,
    undoAuditAction
} from '../services/mcpService.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const router = express.Router();

// Active SSE transport sessions: sessionId -> { transport, user, apiKey }
const activeTransports = new Map();

// In-memory rate limiting: keyId -> { count, windowStart }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/minute

function checkRateLimit(keyIdentifier) {
    const now = Date.now();
    const record = rateLimitMap.get(keyIdentifier) || { count: 0, windowStart: now };

    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        record.count = 1;
        record.windowStart = now;
        rateLimitMap.set(keyIdentifier, record);
        return true;
    }

    record.count += 1;
    rateLimitMap.set(keyIdentifier, record);
    return record.count <= MAX_REQUESTS_PER_WINDOW;
}

/**
 * Authenticate incoming MCP request via Bearer header or token param
 * Returns: { user, apiKey, scopes } or null
 */
async function authenticateMcpToken(req, res) {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1].trim();
    } else if (req.query.token) {
        token = String(req.query.token).trim();
        // Set warning header for token in query parameter
        if (res && !res.headersSent) {
            res.setHeader('X-MCP-Security-Warning', 'Token in query parameter is deprecated. Use Authorization: Bearer <token> header.');
        }
        console.warn(`⚠️ [MCP Security] Request used query param token. Recommend Authorization header.`);
    }

    if (!token) return null;

    // Hash incoming token with SHA-256
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 1. Check in ApiKey collection
    const apiKey = await ApiKey.findOne({ keyHash: tokenHash, revoked: false });

    if (apiKey) {
        // Check expiration
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
            return { isExpired: true };
        }

        // Timing-safe constant-time comparison
        const tokenHashBuf = Buffer.from(tokenHash, 'utf8');
        const storedHashBuf = Buffer.from(apiKey.keyHash, 'utf8');
        if (tokenHashBuf.length !== storedHashBuf.length || !crypto.timingSafeEqual(tokenHashBuf, storedHashBuf)) {
            return null;
        }

        // Rate limit check per API key
        if (!checkRateLimit(apiKey._id.toString())) {
            return { isRateLimited: true };
        }

        // Update last used asynchronously (non-blocking)
        apiKey.lastUsedAt = new Date();
        apiKey.save().catch((e) => console.error('Failed to update apiKey lastUsedAt:', e.message));

        const user = await User.findById(apiKey.user);
        if (!user) return null;

        return {
            user,
            apiKey,
            scopes: Array.isArray(apiKey.scopes) && apiKey.scopes.length > 0 ? apiKey.scopes : ['read']
        };
    }

    // 2. Legacy check against user.mcpApiKey (backward compatibility)
    const legacyUser = await User.findOne({ mcpApiKey: token });
    if (legacyUser) {
        if (!checkRateLimit(legacyUser._id.toString())) {
            return { isRateLimited: true };
        }
        return {
            user: legacyUser,
            apiKey: null,
            scopes: ['read', 'write'] // legacy keys had full access
        };
    }

    return null;
}

// ========================================================
// 1. API Key & Audit Log Management (Protected by JWT)
// ========================================================

/**
 * @desc Get all API keys for user
 * @route GET /api/mcp/keys
 */
router.get('/keys', protect, async (req, res) => {
    try {
        const keys = await ApiKey.find({ user: req.user._id })
            .select('_id name keyPrefix scopes expiresAt lastUsedAt revoked createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        res.json({
            keys,
            serverUrl: `${baseUrl}/api/mcp`,
            sseUrl: `${baseUrl}/api/mcp/sse`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Create a new API key with name, scopes, and optional expiration
 * @route POST /api/mcp/keys
 */
router.post('/keys', protect, async (req, res) => {
    try {
        const { name = 'Claude', scopes = ['read'], expiresInDays = null } = req.body;

        const validScopes = ['read', 'write'];
        const sanitizedScopes = Array.isArray(scopes) 
            ? scopes.filter(s => validScopes.includes(s))
            : ['read'];
        if (sanitizedScopes.length === 0) sanitizedScopes.push('read');

        // Generate high-entropy 24-byte hex token
        const rawKey = `ft_live_${crypto.randomBytes(24).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const keyPrefix = `${rawKey.slice(0, 12)}...`;

        let expiresAt = null;
        if (expiresInDays && Number(expiresInDays) > 0) {
            expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);
        }

        const apiKey = await ApiKey.create({
            user: req.user._id,
            name: String(name).trim() || 'Claude',
            keyHash,
            keyPrefix,
            scopes: sanitizedScopes,
            expiresAt,
            revoked: false
        });

        // Set in User model for single-key backward compatibility if empty
        const user = await User.findById(req.user._id);
        if (user && !user.mcpApiKey) {
            user.mcpApiKey = rawKey;
            user.mcpApiKeyCreatedAt = new Date();
            await user.save();
        }

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        // Return the RAW KEY strictly once!
        res.status(201).json({
            _id: apiKey._id,
            name: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            scopes: apiKey.scopes,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
            rawKey, // One-time display
            serverUrl: `${baseUrl}/api/mcp`,
            sseUrl: `${baseUrl}/api/mcp/sse`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Revoke an API key
 * @route DELETE /api/mcp/keys/:id
 */
router.delete('/keys/:id', protect, async (req, res) => {
    try {
        const apiKey = await ApiKey.findOne({ _id: req.params.id, user: req.user._id });
        if (!apiKey) {
            return res.status(404).json({ message: 'API key not found' });
        }

        apiKey.revoked = true;
        await apiKey.save();

        res.json({ message: 'API key revoked successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Get user's AI Audit Log
 * @route GET /api/mcp/audit
 */
router.get('/audit', protect, async (req, res) => {
    try {
        const logs = await AuditLog.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Revert an AI action from the Audit Log
 * @route POST /api/mcp/audit/:id/undo
 */
router.post('/audit/:id/undo', protect, async (req, res) => {
    try {
        const result = await undoAuditAction(req.user._id, req.params.id);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Legacy single-key endpoints (backward compatibility)
router.get('/token', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('mcpApiKey mcpApiKeyCreatedAt');
        const activeKey = await ApiKey.findOne({ user: req.user._id, revoked: false }).sort({ createdAt: -1 });

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        res.json({
            hasToken: !!activeKey || !!user?.mcpApiKey,
            token: activeKey ? activeKey.keyPrefix : (user?.mcpApiKey || null),
            createdAt: activeKey?.createdAt || user?.mcpApiKeyCreatedAt || null,
            sseUrl: `${baseUrl}/api/mcp/sse`,
            httpUrl: `${baseUrl}/api/mcp`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/token', protect, async (req, res) => {
    // Forward to keys creation
    req.body = { name: 'Claude Default', scopes: ['read', 'write'] };
    const rawKey = `ft_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = `${rawKey.slice(0, 12)}...`;

    const apiKey = await ApiKey.create({
        user: req.user._id,
        name: 'Claude Default',
        keyHash,
        keyPrefix,
        scopes: ['read', 'write'],
        revoked: false
    });

    const user = await User.findById(req.user._id);
    if (user) {
        user.mcpApiKey = rawKey;
        user.mcpApiKeyCreatedAt = new Date();
        await user.save();
    }

    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    res.json({
        token: rawKey,
        keyPrefix,
        createdAt: apiKey.createdAt,
        sseUrl: `${baseUrl}/api/mcp/sse`,
        httpUrl: `${baseUrl}/api/mcp`
    });
});

router.delete('/token', protect, async (req, res) => {
    await ApiKey.updateMany({ user: req.user._id }, { revoked: true });
    await User.findByIdAndUpdate(req.user._id, { mcpApiKey: null, mcpApiKeyCreatedAt: null });
    res.json({ message: 'All MCP tokens revoked successfully' });
});

// ========================================================
// 2. Remote MCP Protocol: SSE Transport
// ========================================================

/**
 * @desc Establish SSE connection for MCP clients
 * @route GET /api/mcp/sse
 */
router.get('/sse', async (req, res) => {
    try {
        const authResult = await authenticateMcpToken(req, res);
        if (!authResult || authResult.isExpired || authResult.isRateLimited) {
            const status = authResult?.isRateLimited ? 429 : 401;
            const message = authResult?.isRateLimited 
                ? 'Rate limit exceeded: Please wait before reconnecting.' 
                : authResult?.isExpired 
                    ? 'Unauthorized: MCP API Key has expired.' 
                    : 'Unauthorized: A valid FinTechPro MCP token is required via Authorization: Bearer <key> header';
            return res.status(status).json({ error: message });
        }

        const { user, apiKey, scopes } = authResult;
        console.log(`🔌 [MCP SSE] Connected user: ${user.email} (Key: ${apiKey?.name || 'Legacy'}, Scopes: ${scopes.join(',')})`);

        const transport = new SSEServerTransport('/api/mcp/messages', res);
        const sessionId = transport.sessionId;
        activeTransports.set(sessionId, { transport, user, apiKey, scopes });

        const server = createMcpServer(user, apiKey);
        await server.connect(transport);

        req.on('close', () => {
            console.log(`🔌 [MCP SSE] Disconnected: session ${sessionId}`);
            activeTransports.delete(sessionId);
        });
    } catch (err) {
        console.error('MCP SSE connection error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

/**
 * @desc Handle client messages for active SSE session
 * @route POST /api/mcp/messages
 */
router.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        return res.status(400).send('Missing sessionId parameter');
    }

    const session = activeTransports.get(sessionId);
    if (!session) {
        return res.status(404).send('Session not found or expired');
    }

    try {
        await session.transport.handlePostMessage(req, res);
    } catch (err) {
        console.error('Error handling MCP post message:', err);
        if (!res.headersSent) {
            res.status(500).send(err.message);
        }
    }
});

// ========================================================
// 3. Direct Stateless JSON-RPC HTTP POST Endpoint
// ========================================================

// Streamable HTTP specification: return 405 Method Not Allowed for GET /api/mcp
router.get('/', (req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'MCP endpoint requires POST (JSON-RPC 2.0). For SSE transport, use GET /api/mcp/sse.'
    });
});

const MCP_TOOLS_DEFINITIONS = [
    {
        name: 'get_portfolio_summary',
        description: "Get high-level summary of the user's investment portfolio including total value, cost basis, cash balances, net worth, profit/loss, return percentage, and broker breakdown.",
        inputSchema: { type: 'object', properties: {} },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_positions',
        description: "Get all stock and fund positions in the user's portfolio with real-time market prices, broker, cost basis, market value, and profit/loss.",
        inputSchema: { type: 'object', properties: {} },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_position_details',
        description: "Get detailed information about a specific position in the user's portfolio including buy lots, broker, and market quote.",
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: "Stock ticker symbol or fund ID, e.g. 'AAPL', 'NVDA', or '5131425'" },
                broker: { type: 'string', description: "Broker or account name (e.g. 'Blink', 'IBI'). Optional, required if same symbol is held across multiple brokers." }
            },
            required: ['symbol']
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_portfolio_news',
        description: "Get latest financial market news specifically for the stocks held in the user's portfolio.",
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: "Maximum number of news items (default: 8)" }
            }
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_watchlist',
        description: "Get the user's watchlist symbols with current market prices and daily changes.",
        inputSchema: { type: 'object', properties: {} },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_cash_balances',
        description: "Get cash balances and money market fund balances across brokers (Blink, IBI, Excellence) and currencies (USD, ILS, EUR).",
        inputSchema: { type: 'object', properties: {} },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'get_transactions',
        description: "Get chronological transaction and lot history across all portfolio positions and recent AI audit actions.",
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: "Maximum number of items (default: 30)" }
            }
        },
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            destructiveHint: false
        }
    },
    {
        name: 'add_position',
        description: "Add a new stock or record additional purchased shares for an existing stock in the user's portfolio. Supports US stocks and Israeli funds (TASE). Blends average cost automatically.",
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: "Stock ticker symbol or fund ID, e.g. 'NVDA', 'AAPL', '5131425'" },
                quantity: { type: 'number', description: "Number of shares bought (must be positive number > 0)" },
                price: { type: 'number', description: "Purchase price per share in USD (optional, current market price used if omitted)" },
                name: { type: 'string', description: "Company or fund name (optional, fetched automatically if omitted)" },
                broker: { type: 'string', description: "Broker or account name, e.g. 'Blink', 'IBI', 'Excellence' (optional, default: 'Default')" },
                date: { type: 'string', description: "Purchase date in YYYY-MM-DD format (optional, defaults to today)" }
            },
            required: ['symbol', 'quantity']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false
        }
    },
    {
        name: 'sell_position',
        description: "Record a sale of shares or close an entire position in the user's portfolio. If quantity is omitted or >= total shares, closes the position.",
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: "Stock ticker symbol to sell, e.g. 'NVDA'" },
                quantity: { type: 'number', description: "Number of shares sold (optional, closes position if omitted or >= total)" },
                broker: { type: 'string', description: "Broker or account name (e.g. 'Blink', 'IBI'). Optional, required if same symbol is held across multiple brokers." }
            },
            required: ['symbol']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        }
    },
    {
        name: 'remove_position',
        description: "Remove a stock position completely from the user's portfolio tracking. Performs a safe soft-delete that can be undone from the AI Audit Log.",
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: "Stock ticker symbol to remove, e.g. 'NVDA'" },
                broker: { type: 'string', description: "Broker or account name (e.g. 'Blink', 'IBI'). Optional, required if same symbol is held across multiple brokers." },
                confirm: { type: 'boolean', description: "Must be true to confirm removal" }
            },
            required: ['symbol']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        }
    },
    {
        name: 'update_position',
        description: "Manually correct/update the total quantity of shares and average purchase price for an existing position.",
        inputSchema: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: "Stock ticker symbol to update, e.g. 'NVDA'" },
                quantity: { type: 'number', description: "New total quantity of shares" },
                averagePrice: { type: 'number', description: "New average price per share in USD" },
                broker: { type: 'string', description: "Broker or account name (e.g. 'Blink', 'IBI'). Optional, required if same symbol is held across multiple brokers." }
            },
            required: ['symbol', 'quantity', 'averagePrice']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false
        }
    },
    {
        name: 'import_positions',
        description: "Bulk import multiple positions into the user's portfolio at once.",
        inputSchema: {
            type: 'object',
            properties: {
                positions: {
                    type: 'array',
                    description: "Array of positions to import: [{ symbol, quantity, price?, broker?, date?, name? }]",
                    items: {
                        type: 'object',
                        properties: {
                            symbol: { type: 'string' },
                            quantity: { type: 'number' },
                            price: { type: 'number' },
                            broker: { type: 'string' },
                            date: { type: 'string' },
                            name: { type: 'string' }
                        },
                        required: ['symbol', 'quantity']
                    }
                }
            },
            required: ['positions']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false
        }
    },
    {
        name: 'update_cash_balance',
        description: "Update cash balance or money market fund balance for a broker and currency.",
        inputSchema: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: "Cash balance amount" },
                currency: { type: 'string', enum: ['USD', 'ILS', 'EUR'], description: "Currency (default: USD)" },
                broker: { type: 'string', description: "Broker name (default: Default)" },
                type: { type: 'string', enum: ['cash', 'money_market'], description: "Balance type: cash or money_market (default: cash)" },
                name: { type: 'string', description: "Optional name or label" }
            },
            required: ['amount']
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false
        }
    }
];

const WRITE_TOOLS = new Set([
    'add_position', 
    'sell_position', 
    'remove_position', 
    'update_position', 
    'import_positions', 
    'update_cash_balance'
]);

router.post('/', async (req, res) => {
    try {
        const authResult = await authenticateMcpToken(req, res);
        if (!authResult || authResult.isExpired || authResult.isRateLimited) {
            const status = authResult?.isRateLimited ? 429 : 401;
            const message = authResult?.isRateLimited 
                ? 'Rate limit exceeded: 120 requests per minute allowed.' 
                : authResult?.isExpired 
                    ? 'Unauthorized: MCP API key has expired.' 
                    : 'Unauthorized: Valid MCP API Key required via Authorization: Bearer <key> header';

            return res.status(status).json({
                jsonrpc: '2.0',
                error: { code: -32000, message },
                id: req.body?.id || null
            });
        }

        const { user, apiKey, scopes } = authResult;
        const { jsonrpc, id, method, params } = req.body;

        // MCP initialize (Protocol Version updated to 2025-06-18)
        if (method === 'initialize') {
            return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2025-06-18',
                    capabilities: {
                        tools: { listChanged: false }
                    },
                    serverInfo: {
                        name: `FinTechPro (${user.name})`,
                        version: '1.1.0'
                    }
                }
            });
        }

        // List tools
        if (method === 'tools/list') {
            return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                    tools: MCP_TOOLS_DEFINITIONS
                }
            });
        }

        // Call tool
        if (method === 'tools/call') {
            const toolName = params?.name;
            const args = params?.arguments || {};

            // Scope Check: Write tools require 'write' scope!
            if (WRITE_TOOLS.has(toolName) && !scopes.includes('write')) {
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        isError: true,
                        content: [{
                            type: 'text',
                            text: `Permission Denied: The API Key used ('${apiKey?.name || 'Default'}') has 'read' permission only. Tool '${toolName}' requires 'write' scope. You can generate a Read+Write key in FinTechPro settings.`
                        }]
                    }
                });
            }

            if (toolName === 'get_portfolio_summary') {
                const data = await getPortfolioMetrics(user._id);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(data.summary, null, 2) }] }
                });
            }

            if (toolName === 'get_positions') {
                const data = await getPortfolioMetrics(user._id);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(data.positions, null, 2) }] }
                });
            }

            if (toolName === 'get_position_details') {
                const symbol = args.symbol?.toUpperCase();
                const broker = args.broker ? String(args.broker).trim() : null;
                const data = await getPortfolioMetrics(user._id);
                let matching = data.positions.filter((p) => p.symbol === symbol);

                if (broker) {
                    matching = matching.filter((p) => (p.broker || 'Default').toLowerCase() === broker.toLowerCase());
                } else if (matching.length > 1) {
                    const brokerList = matching.map(p => `'${p.broker || 'Default'}'`).join(', ');
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: `Multiple positions found for '${symbol}' across brokers: ${brokerList}. Please specify the 'broker' argument (e.g. broker: 'IBI') to target the specific account.` }] }
                    });
                }

                const pos = matching[0];
                if (!pos) {
                    const brokerMsg = broker ? ` in broker '${broker}'` : '';
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: `Position '${symbol}'${brokerMsg} not found in active portfolio.` }] }
                    });
                }
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(pos, null, 2) }] }
                });
            }

            if (toolName === 'get_portfolio_news') {
                const news = await getPortfolioNews(user._id, args.limit || 8);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(news, null, 2) }] }
                });
            }

            if (toolName === 'get_watchlist') {
                const list = await getWatchlistItems(user._id);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] }
                });
            }

            if (toolName === 'get_cash_balances') {
                const data = await getPortfolioMetrics(user._id);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(data.cashBalances, null, 2) }] }
                });
            }

            if (toolName === 'get_transactions') {
                const data = await getTransactions(user._id, args.limit || 30);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
                });
            }

            if (toolName === 'add_position') {
                try {
                    const result = await addOrUpdatePosition(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to add position: ${err.message}` }] }
                    });
                }
            }

            if (toolName === 'sell_position') {
                try {
                    const result = await sellPosition(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to sell position: ${err.message}` }] }
                    });
                }
            }

            if (toolName === 'remove_position') {
                try {
                    const result = await removePosition(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to remove position: ${err.message}` }] }
                    });
                }
            }

            if (toolName === 'update_position') {
                try {
                    const result = await updatePositionHolding(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to update position: ${err.message}` }] }
                    });
                }
            }

            if (toolName === 'import_positions') {
                try {
                    const result = await importPositions(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to import positions: ${err.message}` }] }
                    });
                }
            }

            if (toolName === 'update_cash_balance') {
                try {
                    const result = await updateCashBalance(user._id, args, apiKey);
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                    });
                } catch (err) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { isError: true, content: [{ type: 'text', text: `Failed to update cash balance: ${err.message}` }] }
                    });
                }
            }

            return res.status(404).json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Tool '${toolName}' not found` }
            });
        }

        // Notifications or other methods
        if (method === 'notifications/initialized') {
            return res.status(200).end();
        }

        return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method '${method}' not supported` }
        });
    } catch (err) {
        console.error('Direct MCP call error:', err);
        res.status(500).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: { code: -32603, message: err.message }
        });
    }
});

export default router;
