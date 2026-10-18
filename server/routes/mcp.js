import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { createMcpServer, getPortfolioMetrics, getPortfolioNews, getWatchlistItems } from '../services/mcpService.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const router = express.Router();

// Active SSE transport sessions: sessionId -> { transport, user }
const activeTransports = new Map();

/**
 * Helper to authenticate MCP requests via Bearer token or ?token= query param
 */
async function authenticateMcpToken(req) {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1].trim();
    } else if (req.query.token) {
        token = String(req.query.token).trim();
    }

    if (!token) return null;

    return User.findOne({ mcpApiKey: token });
}

// ========================================================
// 1. User Token Management Routes (Protected by standard JWT)
// ========================================================

/**
 * @desc Get current user's MCP token status
 * @route GET /api/mcp/token
 */
router.get('/token', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('mcpApiKey mcpApiKeyCreatedAt');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        res.json({
            hasToken: !!user.mcpApiKey,
            token: user.mcpApiKey || null,
            createdAt: user.mcpApiKeyCreatedAt || null,
            sseUrl: user.mcpApiKey ? `${baseUrl}/api/mcp/sse?token=${user.mcpApiKey}` : null,
            httpUrl: user.mcpApiKey ? `${baseUrl}/api/mcp?token=${user.mcpApiKey}` : null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Generate or regenerate a personal MCP token
 * @route POST /api/mcp/token
 */
router.post('/token', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newToken = `ft_live_${crypto.randomBytes(24).toString('hex')}`;
        user.mcpApiKey = newToken;
        user.mcpApiKeyCreatedAt = new Date();
        await user.save();

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        res.json({
            token: newToken,
            createdAt: user.mcpApiKeyCreatedAt,
            sseUrl: `${baseUrl}/api/mcp/sse?token=${newToken}`,
            httpUrl: `${baseUrl}/api/mcp?token=${newToken}`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @desc Revoke MCP token
 * @route DELETE /api/mcp/token
 */
router.delete('/token', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.mcpApiKey = null;
        user.mcpApiKeyCreatedAt = null;
        await user.save();

        res.json({ message: 'MCP access token revoked successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
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
        const user = await authenticateMcpToken(req);
        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized: A valid FinTechPro MCP token is required via Authorization: Bearer <token> or ?token=<token>'
            });
        }

        console.log(`🔌 [MCP SSE] Client connected for user: ${user.email}`);

        const transport = new SSEServerTransport('/api/mcp/messages', res);
        const sessionId = transport.sessionId;
        activeTransports.set(sessionId, { transport, user });

        const server = createMcpServer(user);
        await server.connect(transport);

        req.on('close', () => {
            console.log(`🔌 [MCP SSE] Client disconnected: session ${sessionId}`);
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
// (Works with any client, curl, or serverless deployment)
// Streamable HTTP specification: return 405 Method Not Allowed for GET /api/mcp
router.get('/', (req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'MCP endpoint requires POST (JSON-RPC 2.0). For SSE transport, use GET /api/mcp/sse.'
    });
});

router.post('/', async (req, res) => {
    try {
        const user = await authenticateMcpToken(req);
        if (!user) {
            return res.status(401).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Unauthorized: Valid MCP API Key required' },
                id: req.body?.id || null
            });
        }

        const { jsonrpc, id, method, params } = req.body;

        // MCP initialize
        if (method === 'initialize') {
            return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false }
                    },
                    serverInfo: {
                        name: `FinTechPro (${user.name})`,
                        version: '1.0.0'
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
                    tools: [
                        {
                            name: 'get_portfolio_summary',
                            description: "Get high-level summary of the user's investment portfolio including total value, total cost, profit/loss, and return percentage.",
                            inputSchema: { type: 'object', properties: {} }
                        },
                        {
                            name: 'get_positions',
                            description: "Get all stock and fund positions in the user's portfolio with real-time market prices, cost basis, market value, and profit/loss.",
                            inputSchema: { type: 'object', properties: {} }
                        },
                        {
                            name: 'get_position_details',
                            description: "Get detailed information about a specific position in the user's portfolio including buy lots.",
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    symbol: { type: 'string', description: "Stock ticker symbol, e.g. 'AAPL' or 'NVDA'" }
                                },
                                required: ['symbol']
                            }
                        },
                        {
                            name: 'get_portfolio_news',
                            description: "Get the latest financial market news and headlines specifically for the stocks held in the user's portfolio.",
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    limit: { type: 'number', description: "Maximum number of news items (default: 8)" }
                                }
                            }
                        },
                        {
                            name: 'get_watchlist',
                            description: "Get the user's watchlist symbols with their current market prices.",
                            inputSchema: { type: 'object', properties: {} }
                        }
                    ]
                }
            });
        }

        // Call tool
        if (method === 'tools/call') {
            const toolName = params?.name;
            const args = params?.arguments || {};

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
                const data = await getPortfolioMetrics(user._id);
                const pos = data.positions.find((p) => p.symbol === symbol);
                if (!pos) {
                    return res.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content: [{ type: 'text', text: `Position '${symbol}' not found in portfolio.` }] }
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
