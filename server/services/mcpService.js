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
 * Add or increment shares in a position (Buy action)
 */
export async function addOrUpdatePosition(userId, { symbol, quantity, price, name, date }) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error('Stock symbol is required.');
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
        throw new Error('Quantity must be a positive number.');
    }

    let buyPrice = price !== undefined && price !== null ? Number(price) : null;

    // If price wasn't specified, try fetching real-time quote
    if (buyPrice === null || isNaN(buyPrice) || buyPrice <= 0) {
        try {
            const quote = await stockData.getQuote(cleanSymbol);
            if (quote && typeof quote.c === 'number' && quote.c > 0) {
                buyPrice = quote.c;
            }
        } catch {}
    }

    let position = await Position.findOne({ user: userId, symbol: cleanSymbol });

    if (position) {
        if (buyPrice === null || isNaN(buyPrice) || buyPrice <= 0) {
            buyPrice = position.averagePrice;
        }

        const lotDate = date ? new Date(date) : new Date();

        if (!position.lots || position.lots.length === 0) {
            position.lots = [{
                quantity: position.quantity,
                price: position.averagePrice,
                date: position.createdAt || new Date()
            }];
        }

        position.lots.push({
            quantity: qty,
            price: buyPrice,
            date: lotDate
        });

        position.markModified('lots');
        await position.save();

        return {
            success: true,
            action: 'ADDED_LOT',
            symbol: cleanSymbol,
            name: position.name,
            addedQuantity: qty,
            pricePaidUSD: Number(buyPrice.toFixed(2)),
            newTotalShares: position.quantity,
            newAveragePriceUSD: Number(position.averagePrice.toFixed(2)),
            message: `Successfully added ${qty} shares of ${cleanSymbol} at $${buyPrice.toFixed(2)}. New total: ${position.quantity} shares with blended average price of $${position.averagePrice.toFixed(2)}.`
        };
    } else {
        if (buyPrice === null || isNaN(buyPrice) || buyPrice <= 0) {
            throw new Error(`Could not determine market price for ${cleanSymbol}. Please provide an explicit price.`);
        }

        let stockName = name;
        if (!stockName) {
            try {
                const quote = await stockData.getQuote(cleanSymbol);
                stockName = quote?.name || cleanSymbol;
            } catch {
                stockName = cleanSymbol;
            }
        }

        position = await Position.create({
            user: userId,
            symbol: cleanSymbol,
            name: stockName,
            quantity: qty,
            averagePrice: buyPrice,
            lots: [{
                quantity: qty,
                price: buyPrice,
                date: date ? new Date(date) : new Date()
            }]
        });

        return {
            success: true,
            action: 'CREATED_POSITION',
            symbol: cleanSymbol,
            name: position.name,
            shares: qty,
            averagePriceUSD: Number(buyPrice.toFixed(2)),
            message: `Successfully added new position: ${qty} shares of ${cleanSymbol} (${position.name}) at $${buyPrice.toFixed(2)} per share.`
        };
    }
}

/**
 * Sell or reduce shares in an existing position (Sell action)
 */
export async function sellPosition(userId, { symbol, quantity }) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error('Stock symbol is required.');
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const position = await Position.findOne({ user: userId, symbol: cleanSymbol });

    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your portfolio.`);
    }

    const sellQty = quantity !== undefined && quantity !== null ? Number(quantity) : null;

    // Full position liquidation
    if (!sellQty || isNaN(sellQty) || sellQty >= position.quantity) {
        const removedShares = position.quantity;
        await position.deleteOne();
        return {
            success: true,
            action: 'CLOSED_POSITION',
            symbol: cleanSymbol,
            sharesSold: removedShares,
            remainingShares: 0,
            message: `Successfully closed position for ${cleanSymbol}. All ${removedShares} shares removed from your portfolio.`
        };
    }

    // Partial sale (FIFO lot reduction)
    let remainingToSell = sellQty;
    const updatedLots = [];

    for (const lot of (position.lots || [])) {
        if (remainingToSell <= 0) {
            updatedLots.push(lot);
        } else if (lot.quantity <= remainingToSell) {
            remainingToSell -= lot.quantity;
        } else {
            updatedLots.push({
                quantity: lot.quantity - remainingToSell,
                price: lot.price,
                date: lot.date
            });
            remainingToSell = 0;
        }
    }

    if (updatedLots.length === 0) {
        position.quantity = Math.max(0, position.quantity - sellQty);
    } else {
        position.lots = updatedLots;
        position.markModified('lots');
    }

    await position.save();

    return {
        success: true,
        action: 'REDUCED_POSITION',
        symbol: cleanSymbol,
        sharesSold: sellQty,
        remainingShares: position.quantity,
        averagePriceUSD: Number(position.averagePrice.toFixed(2)),
        message: `Successfully recorded sale of ${sellQty} shares of ${cleanSymbol}. Remaining: ${position.quantity} shares at average price $${position.averagePrice.toFixed(2)}.`
    };
}

/**
 * Completely remove a position from tracking
 */
export async function removePosition(userId, { symbol }) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error('Stock symbol is required.');
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const position = await Position.findOneAndDelete({ user: userId, symbol: cleanSymbol });

    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your portfolio.`);
    }

    return {
        success: true,
        action: 'REMOVED_POSITION',
        symbol: cleanSymbol,
        message: `Successfully removed ${cleanSymbol} (${position.name}) from your portfolio.`
    };
}

/**
 * Update / override position holding manually
 */
export async function updatePositionHolding(userId, { symbol, quantity, averagePrice }) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error('Stock symbol is required.');
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    const qty = Number(quantity);
    const avgPrice = Number(averagePrice);

    if (isNaN(qty) || qty <= 0) {
        throw new Error('Quantity must be a positive number.');
    }
    if (isNaN(avgPrice) || avgPrice <= 0) {
        throw new Error('Average price must be a positive number.');
    }

    const position = await Position.findOne({ user: userId, symbol: cleanSymbol });
    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your portfolio.`);
    }

    position.quantity = qty;
    position.averagePrice = avgPrice;
    position.lots = [{
        quantity: qty,
        price: avgPrice,
        date: new Date()
    }];
    position.markModified('lots');
    await position.save();

    return {
        success: true,
        action: 'UPDATED_POSITION',
        symbol: cleanSymbol,
        quantity: position.quantity,
        averagePriceUSD: Number(position.averagePrice.toFixed(2)),
        message: `Successfully updated ${cleanSymbol} to ${position.quantity} shares at an average cost of $${position.averagePrice.toFixed(2)}.`
    };
}

/**
 * Factory to create a personalized MCP Server instance for an authenticated user
 */
export function createMcpServer(user) {
    const server = new McpServer({
        name: `FinTechPro (${user.name})`,
        version: '1.0.0'
    });

    // ==========================================
    // READ TOOLS
    // ==========================================

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

    // ==========================================
    // WRITE / MANAGEMENT TOOLS (Auto-Tracking)
    // ==========================================

    // Tool 6: add_position (Record a Buy)
    server.tool(
        'add_position',
        "Add a new stock or record additional purchased shares for an existing stock in the user's portfolio. Blends average cost automatically.",
        {
            symbol: z.string().describe("Stock ticker symbol, e.g. 'NVDA', 'AAPL', 'MSFT'"),
            quantity: z.number().positive().describe("Number of shares bought (must be positive number)"),
            price: z.number().positive().optional().describe("Purchase price per share in USD. If omitted, current real-time market price will be used automatically."),
            name: z.string().optional().describe("Company or ETF name (optional, fetched automatically if omitted)"),
            date: z.string().optional().describe("Purchase date in YYYY-MM-DD format (optional, defaults to today)")
        },
        async (args) => {
            try {
                const result = await addOrUpdatePosition(user._id, args);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to add position: ${err.message}` }]
                };
            }
        }
    );

    // Tool 7: sell_position (Record a Sale)
    server.tool(
        'sell_position',
        "Record a sale of shares or close an entire position in the user's portfolio. If quantity is omitted or equals/exceeds current shares, closes the position.",
        {
            symbol: z.string().describe("Stock ticker symbol to sell, e.g. 'NVDA'"),
            quantity: z.number().positive().optional().describe("Number of shares sold. If omitted or >= total shares, the position is completely closed.")
        },
        async (args) => {
            try {
                const result = await sellPosition(user._id, args);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to sell position: ${err.message}` }]
                };
            }
        }
    );

    // Tool 8: remove_position (Delete from Tracking)
    server.tool(
        'remove_position',
        "Remove a stock position completely from the user's portfolio tracking.",
        {
            symbol: z.string().describe("Stock ticker symbol to remove, e.g. 'NVDA'")
        },
        async (args) => {
            try {
                const result = await removePosition(user._id, args);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to remove position: ${err.message}` }]
                };
            }
        }
    );

    // Tool 9: update_position (Manual Correction)
    server.tool(
        'update_position',
        "Manually correct/update the total quantity of shares and average purchase price for an existing position.",
        {
            symbol: z.string().describe("Stock ticker symbol to update, e.g. 'NVDA'"),
            quantity: z.number().positive().describe("New total quantity of shares"),
            averagePrice: z.number().positive().describe("New average price per share in USD")
        },
        async (args) => {
            try {
                const result = await updatePositionHolding(user._id, args);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to update position: ${err.message}` }]
                };
            }
        }
    );

    return server;
}
