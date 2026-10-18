import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Position from '../models/Position.js';
import Watchlist from '../models/Watchlist.js';
import * as stockData from './stockDataService.js';

/**
 * Fetch and compute full portfolio details for a user
 */
export async function getPortfolioMetrics(userId) {
    const positions = await Position.find({ user: userId }).lean();

    if (!positions || positions.length === 0) {
        return {
            summary: {
                totalPositions: 0,
                totalCostBasisUSD: 0,
                totalMarketValueUSD: 0,
                totalProfitLossUSD: 0,
                totalReturnPercent: 0,
                message: 'No open positions in portfolio.'
            },
            positions: []
        };
    }

    let totalCostBasis = 0;
    let totalMarketValue = 0;

    const enrichedPositions = await Promise.all(
        positions.map(async (pos) => {
            let currentPrice = pos.averagePrice;
            let dailyChangePercent = 0;

            try {
                const quote = await stockData.getQuote(pos.symbol);
                if (quote && typeof quote.c === 'number' && quote.c > 0) {
                    currentPrice = quote.c;
                    dailyChangePercent = quote.dp || 0;
                }
            } catch (err) {
                console.warn(`[MCP] Failed to fetch quote for ${pos.symbol}:`, err.message);
            }

            const costBasis = pos.quantity * pos.averagePrice;
            const marketValue = pos.quantity * currentPrice;
            const profitLossUSD = marketValue - costBasis;
            const profitLossPercent = costBasis > 0 ? (profitLossUSD / costBasis) * 100 : 0;

            totalCostBasis += costBasis;
            totalMarketValue += marketValue;

            return {
                id: pos._id.toString(),
                symbol: pos.symbol,
                name: pos.name,
                quantity: pos.quantity,
                averagePrice: Number(pos.averagePrice.toFixed(2)),
                currentPrice: Number(currentPrice.toFixed(2)),
                dailyChangePercent: Number(dailyChangePercent.toFixed(2)),
                costBasisUSD: Number(costBasis.toFixed(2)),
                marketValueUSD: Number(marketValue.toFixed(2)),
                unrealizedProfitLossUSD: Number(profitLossUSD.toFixed(2)),
                unrealizedProfitLossPercent: Number(profitLossPercent.toFixed(2)),
                lotsCount: pos.lots ? pos.lots.length : 1
            };
        })
    );

    const totalProfitLoss = totalMarketValue - totalCostBasis;
    const totalReturnPercent = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;

    // Add portfolio weight / allocation to each position
    const positionsWithWeight = enrichedPositions.map((pos) => ({
        ...pos,
        portfolioWeightPercent: totalMarketValue > 0
            ? Number(((pos.marketValueUSD / totalMarketValue) * 100).toFixed(2))
            : 0
    }));

    return {
        summary: {
            totalPositions: positionsWithWeight.length,
            totalCostBasisUSD: Number(totalCostBasis.toFixed(2)),
            totalMarketValueUSD: Number(totalMarketValue.toFixed(2)),
            totalProfitLossUSD: Number(totalProfitLoss.toFixed(2)),
            totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
            topPerformer: [...positionsWithWeight].sort((a, b) => b.unrealizedProfitLossPercent - a.unrealizedProfitLossPercent)[0]?.symbol || null,
            underPerformer: [...positionsWithWeight].sort((a, b) => a.unrealizedProfitLossPercent - b.unrealizedProfitLossPercent)[0]?.symbol || null
        },
        positions: positionsWithWeight
    };
}

/**
 * Fetch portfolio news for user's held stocks
 */
export async function getPortfolioNews(userId, limit = 10) {
    const positions = await Position.find({ user: userId }).select('symbol').lean();
    if (!positions || positions.length === 0) {
        return [];
    }

    const symbols = [...new Set(positions.map((p) => p.symbol))];
    const newsPromises = symbols.slice(0, 5).map(async (sym) => {
        try {
            const news = await stockData.getCompanyNews(sym);
            return (news || []).map((item) => ({
                symbol: sym,
                headline: item.headline,
                summary: item.summary,
                source: item.source,
                url: item.url,
                datetime: item.datetime ? new Date(item.datetime * 1000).toISOString() : null
            }));
        } catch {
            return [];
        }
    });

    const results = await Promise.all(newsPromises);
    const allNews = results.flat().sort((a, b) => (new Date(b.datetime || 0).getTime() - new Date(a.datetime || 0).getTime()));
    return allNews.slice(0, limit);
}

/**
 * Fetch watchlist for user
 */
export async function getWatchlistItems(userId) {
    const items = await Watchlist.find({ user: userId }).lean();
    if (!items || items.length === 0) return [];

    return Promise.all(
        items.map(async (item) => {
            let quote = null;
            try {
                quote = await stockData.getQuote(item.symbol);
            } catch {}
            return {
                symbol: item.symbol,
                name: item.name,
                currentPrice: quote?.c || null,
                changePercent: quote?.dp || null
            };
        })
    );
}

/**
 * Factory to create a personalized MCP Server instance for an authenticated user
 */
export function createMcpServer(user) {
    const server = new McpServer({
        name: `FinTechPro (${user.name})`,
        version: '1.0.0'
    });

    // Tool 1: get_portfolio_summary
    server.tool(
        'get_portfolio_summary',
        "Get a high-level summary of the user's investment portfolio, including total value in USD, total invested amount, total unrealized profit/loss, return percentage, and top/bottom performers.",
        {},
        async () => {
            const data = await getPortfolioMetrics(user._id);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(data.summary, null, 2)
                }]
            };
        }
    );

    // Tool 2: get_positions
    server.tool(
        'get_positions',
        "Get all stock and fund positions in the user's portfolio, with real-time market prices, shares count, cost basis, current market value, unrealized gain/loss ($ and %), and portfolio weights.",
        {},
        async () => {
            const data = await getPortfolioMetrics(user._id);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(data.positions, null, 2)
                }]
            };
        }
    );

    // Tool 3: get_position_details
    server.tool(
        'get_position_details',
        "Get detailed information on a specific stock position in the user's portfolio, including buy lot history and purchase dates.",
        {
            symbol: z.string().describe("Stock ticker symbol, e.g. 'AAPL' or 'NVDA'")
        },
        async ({ symbol }) => {
            const pos = await Position.findOne({
                user: user._id,
                symbol: symbol.toUpperCase()
            }).lean();

            if (!pos) {
                return {
                    content: [{
                        type: 'text',
                        text: `Position for symbol '${symbol.toUpperCase()}' was not found in your portfolio.`
                    }]
                };
            }

            let quote = null;
            try {
                quote = await stockData.getQuote(pos.symbol);
            } catch {}

            const currentPrice = quote?.c || pos.averagePrice;
            const marketValue = pos.quantity * currentPrice;
            const costBasis = pos.quantity * pos.averagePrice;
            const profitLossUSD = marketValue - costBasis;
            const profitLossPercent = costBasis > 0 ? (profitLossUSD / costBasis) * 100 : 0;

            const details = {
                symbol: pos.symbol,
                name: pos.name,
                quantity: pos.quantity,
                averagePrice: pos.averagePrice,
                currentPrice,
                marketValueUSD: Number(marketValue.toFixed(2)),
                costBasisUSD: Number(costBasis.toFixed(2)),
                profitLossUSD: Number(profitLossUSD.toFixed(2)),
                profitLossPercent: Number(profitLossPercent.toFixed(2)),
                lots: (pos.lots || []).map((lot) => ({
                    quantity: lot.quantity,
                    price: lot.price,
                    date: lot.date
                })),
                quoteDetails: quote ? {
                    highOfDay: quote.h,
                    lowOfDay: quote.l,
                    openPrice: quote.o,
                    previousClose: quote.pc,
                    changePercent: quote.dp
                } : null
            };

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(details, null, 2)
                }]
            };
        }
    );

    // Tool 4: get_portfolio_news
    server.tool(
        'get_portfolio_news',
        "Get the latest financial market news and headlines specifically for the stocks held in the user's portfolio.",
        {
            limit: z.number().optional().describe("Maximum number of news items to return (default: 8)")
        },
        async ({ limit }) => {
            const news = await getPortfolioNews(user._id, limit || 8);
            return {
                content: [{
                    type: 'text',
                    text: news.length > 0
                        ? JSON.stringify(news, null, 2)
                        : "No recent news found for your portfolio stocks."
                }]
            };
        }
    );

    // Tool 5: get_watchlist
    server.tool(
        'get_watchlist',
        "Get the user's watchlist symbols with their current market prices and daily percent changes.",
        {},
        async () => {
            const watchlist = await getWatchlistItems(user._id);
            return {
                content: [{
                    type: 'text',
                    text: watchlist.length > 0
                        ? JSON.stringify(watchlist, null, 2)
                        : "Your watchlist is currently empty."
                }]
            };
        }
    );

    return server;
}
