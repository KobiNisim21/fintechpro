import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Position from '../models/Position.js';
import Watchlist from '../models/Watchlist.js';
import CashBalance from '../models/CashBalance.js';
import AuditLog from '../models/AuditLog.js';
import * as stockData from './stockDataService.js';
import { fetchFundNAV } from './israeliSecuritiesService.js';

/**
 * Log an AI agent action into the AuditLog collection
 */
export async function logAuditAction({
    userId,
    apiKeyContext = null,
    action,
    symbol = null,
    details,
    beforeState = null,
    afterState = null,
    canUndo = true
}) {
    try {
        const apiKeyId = apiKeyContext?._id || null;
        const keyName = apiKeyContext?.name || 'AI Agent';

        const audit = await AuditLog.create({
            user: userId,
            apiKeyId,
            keyName,
            action,
            symbol: symbol ? symbol.toUpperCase() : null,
            details,
            beforeState,
            afterState,
            canUndo,
            undone: false
        });
        return audit;
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
        return null;
    }
}

/**
 * Revert an AI agent change
 */
export async function undoAuditAction(userId, auditLogId) {
    const audit = await AuditLog.findOne({ _id: auditLogId, user: userId });
    if (!audit) {
        throw new Error('Audit log record not found');
    }
    if (audit.undone) {
        throw new Error('This action has already been undone');
    }
    if (!audit.canUndo) {
        throw new Error('This action cannot be automatically undone');
    }

    const { action, symbol, beforeState, afterState } = audit;

    switch (action) {
        case 'add_position': {
            if (!beforeState) {
                // Was a newly created position -> soft delete it
                const pos = await Position.findOne({ user: userId, symbol, isDeleted: { $ne: true } });
                if (pos) {
                    pos.isDeleted = true;
                    pos.deletedAt = new Date();
                    await pos.save();
                }
            } else {
                // An additional lot was added -> restore previous quantity, averagePrice, and lots
                const pos = await Position.findOne({ user: userId, symbol, isDeleted: { $ne: true } });
                if (pos) {
                    pos.quantity = beforeState.quantity;
                    pos.averagePrice = beforeState.averagePrice;
                    pos.lots = beforeState.lots;
                    pos.markModified('lots');
                    await pos.save();
                }
            }
            break;
        }

        case 'remove_position': {
            // Restore soft-deleted position
            let pos = await Position.findOne({ user: userId, symbol, isDeleted: true });
            if (!pos) {
                // If it was hard deleted in past or not found
                if (beforeState) {
                    pos = await Position.create({
                        user: userId,
                        symbol: beforeState.symbol,
                        name: beforeState.name,
                        quantity: beforeState.quantity,
                        averagePrice: beforeState.averagePrice,
                        broker: beforeState.broker || 'Default',
                        lots: beforeState.lots || [],
                        isDeleted: false
                    });
                }
            } else {
                pos.isDeleted = false;
                pos.deletedAt = null;
                if (beforeState) {
                    pos.quantity = beforeState.quantity;
                    pos.averagePrice = beforeState.averagePrice;
                    pos.lots = beforeState.lots;
                    pos.markModified('lots');
                }
                await pos.save();
            }
            break;
        }

        case 'sell_position': {
            let pos = await Position.findOne({ user: userId, symbol });
            if (!pos) {
                // Entire position was liquidated
                if (beforeState) {
                    await Position.create({
                        user: userId,
                        symbol: beforeState.symbol,
                        name: beforeState.name,
                        quantity: beforeState.quantity,
                        averagePrice: beforeState.averagePrice,
                        broker: beforeState.broker || 'Default',
                        lots: beforeState.lots || [],
                        isDeleted: false
                    });
                }
            } else {
                pos.isDeleted = false;
                pos.deletedAt = null;
                pos.quantity = beforeState.quantity;
                pos.averagePrice = beforeState.averagePrice;
                pos.lots = beforeState.lots;
                pos.markModified('lots');
                await pos.save();
            }
            break;
        }

        case 'update_position': {
            const pos = await Position.findOne({ user: userId, symbol, isDeleted: { $ne: true } });
            if (pos && beforeState) {
                pos.quantity = beforeState.quantity;
                pos.averagePrice = beforeState.averagePrice;
                pos.lots = beforeState.lots;
                pos.markModified('lots');
                await pos.save();
            }
            break;
        }

        case 'update_cash_balance': {
            if (beforeState) {
                await CashBalance.findOneAndUpdate(
                    { user: userId, broker: beforeState.broker, currency: beforeState.currency, type: beforeState.type },
                    { amount: beforeState.amount, updatedAt: new Date() },
                    { upsert: true }
                );
            } else if (afterState) {
                await CashBalance.deleteOne({
                    user: userId,
                    broker: afterState.broker,
                    currency: afterState.currency,
                    type: afterState.type
                });
            }
            break;
        }

        case 'import_positions': {
            // If beforeState has array of positions or ids
            if (Array.isArray(audit.beforeState?.createdSymbols)) {
                for (const sym of audit.beforeState.createdSymbols) {
                    await Position.findOneAndUpdate(
                        { user: userId, symbol: sym, isDeleted: { $ne: true } },
                        { isDeleted: true, deletedAt: new Date() }
                    );
                }
            }
            break;
        }

        default:
            throw new Error(`Cannot undo action of type: ${action}`);
    }

    audit.undone = true;
    audit.undoneAt = new Date();
    await audit.save();

    return {
        success: true,
        message: `Successfully undone action '${audit.action}' for ${audit.symbol || 'portfolio item'}.`
    };
}

/**
 * Fetch and compute full portfolio details for a user (including cash, brokers, and Israeli securities)
 */
export async function getPortfolioMetrics(userId) {
    const [positions, cashBalances] = await Promise.all([
        Position.find({ user: userId, isDeleted: { $ne: true } }).lean(),
        CashBalance.find({ user: userId }).lean()
    ]);

    // Compute Forex rates for ILS and EUR to USD
    let usdIlsRate = 3.65;
    try {
        const forex = await stockData.getForexRate();
        if (forex?.rate) usdIlsRate = forex.rate;
    } catch {
        // fallback
    }

    // Process Cash Balances
    let totalCashUSD = 0;
    const enrichedCash = (cashBalances || []).map((cb) => {
        let amountUSD = cb.amount;
        if (cb.currency === 'ILS') {
            amountUSD = cb.amount / usdIlsRate;
        } else if (cb.currency === 'EUR') {
            amountUSD = cb.amount * 1.08;
        }
        totalCashUSD += amountUSD;

        return {
            id: cb._id.toString(),
            broker: cb.broker || 'Default',
            currency: cb.currency,
            amount: cb.amount,
            amountUSD: Number(amountUSD.toFixed(2)),
            type: cb.type,
            name: cb.name || (cb.type === 'money_market' ? 'Money Market Fund' : 'Cash')
        };
    });

    if (!positions || positions.length === 0) {
        return {
            summary: {
                totalPositions: 0,
                totalCostBasisUSD: 0,
                totalMarketValueUSD: 0,
                totalProfitLossUSD: 0,
                totalReturnPercent: 0,
                totalCashUSD: Number(totalCashUSD.toFixed(2)),
                totalNetWorthUSD: Number(totalCashUSD.toFixed(2)),
                cashBalances: enrichedCash,
                brokerBreakdown: enrichedCash.reduce((acc, c) => {
                    acc[c.broker] = acc[c.broker] || { marketValueUSD: 0, cashUSD: 0, totalUSD: 0 };
                    acc[c.broker].cashUSD += c.amountUSD;
                    acc[c.broker].totalUSD += c.amountUSD;
                    return acc;
                }, {}),
                message: 'No open stock positions in portfolio.'
            },
            positions: [],
            cashBalances: enrichedCash
        };
    }

    let totalCostBasis = 0;
    let totalMarketValue = 0;

    const enrichedPositions = await Promise.all(
        positions.map(async (pos) => {
            let currentPrice = pos.averagePrice;
            let dailyChangePercent = 0;
            const isIsraeli = pos.symbol.startsWith('FUND:') || pos.symbol.endsWith('.TA');

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
                broker: pos.broker || 'Default',
                isIsraeli,
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
    const totalNetWorthUSD = totalMarketValue + totalCashUSD;

    // Add portfolio weight / allocation to each position
    const positionsWithWeight = enrichedPositions.map((pos) => ({
        ...pos,
        portfolioWeightPercent: totalMarketValue > 0
            ? Number(((pos.marketValueUSD / totalMarketValue) * 100).toFixed(2))
            : 0
    }));

    // Grouping by Broker
    const brokerBreakdown = {};
    for (const p of positionsWithWeight) {
        const b = p.broker || 'Default';
        brokerBreakdown[b] = brokerBreakdown[b] || { marketValueUSD: 0, cashUSD: 0, totalUSD: 0, positionsCount: 0 };
        brokerBreakdown[b].marketValueUSD += p.marketValueUSD;
        brokerBreakdown[b].totalUSD += p.marketValueUSD;
        brokerBreakdown[b].positionsCount += 1;
    }
    for (const c of enrichedCash) {
        const b = c.broker || 'Default';
        brokerBreakdown[b] = brokerBreakdown[b] || { marketValueUSD: 0, cashUSD: 0, totalUSD: 0, positionsCount: 0 };
        brokerBreakdown[b].cashUSD += c.amountUSD;
        brokerBreakdown[b].totalUSD += c.amountUSD;
    }
    for (const b in brokerBreakdown) {
        brokerBreakdown[b].marketValueUSD = Number(brokerBreakdown[b].marketValueUSD.toFixed(2));
        brokerBreakdown[b].cashUSD = Number(brokerBreakdown[b].cashUSD.toFixed(2));
        brokerBreakdown[b].totalUSD = Number(brokerBreakdown[b].totalUSD.toFixed(2));
    }

    return {
        summary: {
            totalPositions: positionsWithWeight.length,
            totalCostBasisUSD: Number(totalCostBasis.toFixed(2)),
            totalMarketValueUSD: Number(totalMarketValue.toFixed(2)),
            totalProfitLossUSD: Number(totalProfitLoss.toFixed(2)),
            totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
            totalCashUSD: Number(totalCashUSD.toFixed(2)),
            totalNetWorthUSD: Number(totalNetWorthUSD.toFixed(2)),
            topPerformer: [...positionsWithWeight].sort((a, b) => b.unrealizedProfitLossPercent - a.unrealizedProfitLossPercent)[0]?.symbol || null,
            underPerformer: [...positionsWithWeight].sort((a, b) => a.unrealizedProfitLossPercent - b.unrealizedProfitLossPercent)[0]?.symbol || null,
            brokerBreakdown
        },
        positions: positionsWithWeight,
        cashBalances: enrichedCash
    };
}

/**
 * Fetch portfolio news for user's held stocks
 */
export async function getPortfolioNews(userId, limit = 10) {
    const positions = await Position.find({ user: userId, isDeleted: { $ne: true } }).select('symbol').lean();
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
 * Normalize symbol (handles Israeli mutual fund IDs like 5131425)
 */
export function normalizeSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return '';
    let clean = symbol.trim().toUpperCase();
    // If it's a numeric ID (e.g. 5131425), format as FUND:5131425
    if (/^\d{6,8}$/.test(clean)) {
        clean = `FUND:${clean}`;
    }
    return clean;
}

/**
 * Add or increment shares in a position (Buy action) with Audit Logging
 */
export async function addOrUpdatePosition(userId, { symbol, quantity, price, name, date, broker }, apiKeyContext = null) {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) {
        throw new Error('Stock symbol is required.');
    }
    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
        throw new Error('Quantity must be a positive number greater than 0.');
    }

    let buyPrice = price !== undefined && price !== null ? Number(price) : null;
    if (buyPrice !== null && (isNaN(buyPrice) || buyPrice <= 0 || buyPrice > 1000000)) {
        throw new Error('Price must be a valid positive number within reasonable range (up to $1,000,000).');
    }

    // If price wasn't specified, try fetching real-time quote
    if (buyPrice === null) {
        try {
            const quote = await stockData.getQuote(cleanSymbol);
            if (quote && typeof quote.c === 'number' && quote.c > 0) {
                buyPrice = quote.c;
            }
        } catch {}
    }

    const assignedBroker = broker && typeof broker === 'string' ? broker.trim() : 'Default';
    let position = await Position.findOne({ user: userId, symbol: cleanSymbol, isDeleted: { $ne: true } });

    if (position) {
        if (buyPrice === null || isNaN(buyPrice) || buyPrice <= 0) {
            buyPrice = position.averagePrice;
        }

        const beforeState = {
            symbol: position.symbol,
            name: position.name,
            quantity: position.quantity,
            averagePrice: position.averagePrice,
            broker: position.broker,
            lots: JSON.parse(JSON.stringify(position.lots || []))
        };

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

        if (broker && position.broker === 'Default') {
            position.broker = assignedBroker;
        }

        position.markModified('lots');
        await position.save();

        const afterState = {
            symbol: position.symbol,
            name: position.name,
            quantity: position.quantity,
            averagePrice: position.averagePrice,
            broker: position.broker,
            lots: JSON.parse(JSON.stringify(position.lots || []))
        };

        const details = `Added ${qty} shares of ${cleanSymbol} at $${buyPrice.toFixed(2)} (${assignedBroker}). New total: ${position.quantity} shares.`;

        await logAuditAction({
            userId,
            apiKeyContext,
            action: 'add_position',
            symbol: cleanSymbol,
            details,
            beforeState,
            afterState
        });

        return {
            success: true,
            action: 'ADDED_LOT',
            symbol: cleanSymbol,
            name: position.name,
            broker: position.broker,
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
            broker: assignedBroker,
            quantity: qty,
            averagePrice: buyPrice,
            lots: [{
                quantity: qty,
                price: buyPrice,
                date: date ? new Date(date) : new Date()
            }],
            isDeleted: false
        });

        const afterState = {
            symbol: position.symbol,
            name: position.name,
            quantity: position.quantity,
            averagePrice: position.averagePrice,
            broker: position.broker,
            lots: JSON.parse(JSON.stringify(position.lots || []))
        };

        const details = `Created new position: ${qty} shares of ${cleanSymbol} (${stockName}) at $${buyPrice.toFixed(2)} in ${assignedBroker}.`;

        await logAuditAction({
            userId,
            apiKeyContext,
            action: 'add_position',
            symbol: cleanSymbol,
            details,
            beforeState: null,
            afterState
        });

        return {
            success: true,
            action: 'CREATED_POSITION',
            symbol: cleanSymbol,
            name: position.name,
            broker: position.broker,
            shares: qty,
            averagePriceUSD: Number(buyPrice.toFixed(2)),
            message: `Successfully added new position: ${qty} shares of ${cleanSymbol} (${position.name}) at $${buyPrice.toFixed(2)} per share.`
        };
    }
}

/**
 * Sell or reduce shares in an existing position (Sell action) with Audit Logging
 */
export async function sellPosition(userId, { symbol, quantity, broker }, apiKeyContext = null) {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) {
        throw new Error('Stock symbol is required.');
    }

    const query = { user: userId, symbol: cleanSymbol, isDeleted: { $ne: true } };
    if (broker) query.broker = broker.trim();

    const position = await Position.findOne(query);
    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your active portfolio.`);
    }

    const beforeState = {
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        broker: position.broker,
        lots: JSON.parse(JSON.stringify(position.lots || []))
    };

    const sellQty = quantity !== undefined && quantity !== null ? Number(quantity) : null;

    // Full position liquidation
    if (!sellQty || isNaN(sellQty) || sellQty >= position.quantity) {
        const removedShares = position.quantity;
        // Soft delete position so it can be completely undone if desired
        position.isDeleted = true;
        position.deletedAt = new Date();
        await position.save();

        const details = `Liquidated entire position: ${removedShares} shares of ${cleanSymbol}.`;

        await logAuditAction({
            userId,
            apiKeyContext,
            action: 'sell_position',
            symbol: cleanSymbol,
            details,
            beforeState,
            afterState: null
        });

        return {
            success: true,
            action: 'CLOSED_POSITION',
            symbol: cleanSymbol,
            sharesSold: removedShares,
            remainingShares: 0,
            message: `Successfully closed position for ${cleanSymbol}. All ${removedShares} shares removed from active portfolio.`
        };
    }

    if (sellQty <= 0) {
        throw new Error('Sell quantity must be a positive number.');
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

    const afterState = {
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        broker: position.broker,
        lots: JSON.parse(JSON.stringify(position.lots || []))
    };

    const details = `Sold ${sellQty} shares of ${cleanSymbol}. Remaining: ${position.quantity} shares.`;

    await logAuditAction({
        userId,
        apiKeyContext,
        action: 'sell_position',
        symbol: cleanSymbol,
        details,
        beforeState,
        afterState
    });

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
 * Remove a position completely (Soft-Delete) with Audit Logging
 */
export async function removePosition(userId, { symbol, broker, confirm = true }, apiKeyContext = null) {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) {
        throw new Error('Stock symbol is required.');
    }

    const query = { user: userId, symbol: cleanSymbol, isDeleted: { $ne: true } };
    if (broker) query.broker = broker.trim();

    const position = await Position.findOne(query);
    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your portfolio.`);
    }

    const beforeState = {
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        broker: position.broker,
        lots: JSON.parse(JSON.stringify(position.lots || []))
    };

    // Soft-delete for instant reversibility
    position.isDeleted = true;
    position.deletedAt = new Date();
    await position.save();

    const details = `Removed position ${cleanSymbol} (${position.name}, ${position.quantity} shares).`;

    await logAuditAction({
        userId,
        apiKeyContext,
        action: 'remove_position',
        symbol: cleanSymbol,
        details,
        beforeState,
        afterState: null
    });

    return {
        success: true,
        action: 'REMOVED_POSITION',
        symbol: cleanSymbol,
        message: `Successfully removed ${cleanSymbol} (${position.name}) from your portfolio. This change can be undone anytime from the AI Audit Log.`
    };
}

/**
 * Update / override position holding manually with Audit Logging
 */
export async function updatePositionHolding(userId, { symbol, quantity, averagePrice, broker }, apiKeyContext = null) {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) {
        throw new Error('Stock symbol is required.');
    }
    const qty = Number(quantity);
    const avgPrice = Number(averagePrice);

    if (isNaN(qty) || qty <= 0) {
        throw new Error('Quantity must be a positive number.');
    }
    if (isNaN(avgPrice) || avgPrice <= 0 || avgPrice > 1000000) {
        throw new Error('Average price must be a positive number within reasonable range.');
    }

    const query = { user: userId, symbol: cleanSymbol, isDeleted: { $ne: true } };
    if (broker) query.broker = broker.trim();

    const position = await Position.findOne(query);
    if (!position) {
        throw new Error(`Position '${cleanSymbol}' was not found in your portfolio.`);
    }

    const beforeState = {
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        broker: position.broker,
        lots: JSON.parse(JSON.stringify(position.lots || []))
    };

    position.quantity = qty;
    position.averagePrice = avgPrice;
    position.lots = [{
        quantity: qty,
        price: avgPrice,
        date: new Date()
    }];
    if (broker) position.broker = broker.trim();
    position.markModified('lots');
    await position.save();

    const afterState = {
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        broker: position.broker,
        lots: JSON.parse(JSON.stringify(position.lots || []))
    };

    const details = `Updated ${cleanSymbol}: quantity set to ${qty}, average price to $${avgPrice.toFixed(2)}.`;

    await logAuditAction({
        userId,
        apiKeyContext,
        action: 'update_position',
        symbol: cleanSymbol,
        details,
        beforeState,
        afterState
    });

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
 * Bulk import multiple positions at once
 */
export async function importPositions(userId, { positions }, apiKeyContext = null) {
    if (!Array.isArray(positions) || positions.length === 0) {
        throw new Error('Positions array is required and must not be empty.');
    }

    const results = [];
    const createdSymbols = [];

    for (const item of positions) {
        try {
            const res = await addOrUpdatePosition(userId, item, apiKeyContext);
            results.push({ symbol: item.symbol, success: true, result: res });
            createdSymbols.push(normalizeSymbol(item.symbol));
        } catch (err) {
            results.push({ symbol: item.symbol, success: false, error: err.message });
        }
    }

    const successfulCount = results.filter((r) => r.success).length;

    await logAuditAction({
        userId,
        apiKeyContext,
        action: 'import_positions',
        symbol: 'BULK_IMPORT',
        details: `Imported ${successfulCount} of ${positions.length} positions in bulk.`,
        beforeState: { createdSymbols },
        afterState: { totalImported: successfulCount }
    });

    return {
        success: true,
        total: positions.length,
        successfulCount,
        failedCount: positions.length - successfulCount,
        results
    };
}

/**
 * Update cash balance for broker and currency
 */
export async function updateCashBalance(userId, { amount, currency = 'USD', broker = 'Default', type = 'cash', name = '' }, apiKeyContext = null) {
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
        throw new Error('Cash amount must be a valid number.');
    }

    const cleanCurrency = String(currency).toUpperCase().trim();
    if (!['USD', 'ILS', 'EUR'].includes(cleanCurrency)) {
        throw new Error("Currency must be 'USD', 'ILS', or 'EUR'.");
    }

    const cleanBroker = (broker || 'Default').trim();
    const cleanType = type === 'money_market' ? 'money_market' : 'cash';

    const existing = await CashBalance.findOne({
        user: userId,
        broker: cleanBroker,
        currency: cleanCurrency,
        type: cleanType
    });

    const beforeState = existing ? {
        amount: existing.amount,
        currency: existing.currency,
        broker: existing.broker,
        type: existing.type
    } : null;

    const updated = await CashBalance.findOneAndUpdate(
        { user: userId, broker: cleanBroker, currency: cleanCurrency, type: cleanType },
        { amount: numAmount, name: name || existing?.name || '', updatedAt: new Date() },
        { upsert: true, new: true }
    );

    const afterState = {
        amount: updated.amount,
        currency: updated.currency,
        broker: updated.broker,
        type: updated.type
    };

    const details = `Updated cash balance for ${cleanBroker} (${cleanCurrency}): ${numAmount.toLocaleString()} ${cleanCurrency}.`;

    await logAuditAction({
        userId,
        apiKeyContext,
        action: 'update_cash_balance',
        symbol: cleanCurrency,
        details,
        beforeState,
        afterState
    });

    return {
        success: true,
        broker: updated.broker,
        currency: updated.currency,
        amount: updated.amount,
        type: updated.type,
        message: `Successfully set cash balance for ${updated.broker} (${updated.currency}) to ${updated.amount}.`
    };
}

/**
 * Get transaction and lot history across all positions and audit logs
 */
export async function getTransactions(userId, limit = 50) {
    const [positions, auditLogs] = await Promise.all([
        Position.find({ user: userId }).lean(),
        AuditLog.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean()
    ]);

    const lotsTransactions = [];
    for (const p of positions) {
        for (const lot of (p.lots || [])) {
            lotsTransactions.push({
                type: 'BUY',
                symbol: p.symbol,
                name: p.name,
                broker: p.broker || 'Default',
                quantity: lot.quantity,
                priceUSD: lot.price,
                totalUSD: Number((lot.quantity * lot.price).toFixed(2)),
                date: lot.date || p.createdAt
            });
        }
    }

    return {
        lots: lotsTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit),
        recentAuditLogs: auditLogs.map(a => ({
            id: a._id,
            action: a.action,
            symbol: a.symbol,
            details: a.details,
            keyName: a.keyName,
            canUndo: a.canUndo && !a.undone,
            undone: a.undone,
            createdAt: a.createdAt
        }))
    };
}

/**
 * Factory to create a personalized MCP Server instance for an authenticated user
 */
export function createMcpServer(user, apiKeyContext = null) {
    const server = new McpServer({
        name: `FinTechPro (${user.name})`,
        version: '1.1.0'
    });

    // ==========================================
    // READ TOOLS (readOnlyHint: true)
    // ==========================================

    // Tool 1: get_portfolio_summary
    server.tool(
        'get_portfolio_summary',
        "Get high-level summary of the user's investment portfolio including total value, cost basis, cash balances, net worth, profit/loss, return percentage, and broker breakdown.",
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
        "Get all stock and fund positions in the user's portfolio, with real-time market prices, broker, shares count, cost basis, current market value, unrealized gain/loss ($ and %), and portfolio weights.",
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
        "Get detailed information on a specific stock position in the user's portfolio, including buy lot history, purchase dates, and broker.",
        {
            symbol: z.string().describe("Stock ticker symbol or fund ID, e.g. 'AAPL', 'NVDA', or '5131425'")
        },
        async ({ symbol }) => {
            const clean = normalizeSymbol(symbol);
            const pos = await Position.findOne({
                user: user._id,
                symbol: clean,
                isDeleted: { $ne: true }
            }).lean();

            if (!pos) {
                return {
                    content: [{
                        type: 'text',
                        text: `Position for symbol '${clean}' was not found in active portfolio.`
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
                broker: pos.broker || 'Default',
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
        "Get latest financial market news and headlines specifically for stocks held in the user's portfolio.",
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
        "Get the user's watchlist symbols with current market prices and daily percent changes.",
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

    // Tool 6: get_cash_balances
    server.tool(
        'get_cash_balances',
        "Get cash balances and money market fund balances across brokers (e.g. Blink, IBI) and currencies (USD, ILS, EUR).",
        {},
        async () => {
            const cash = await CashBalance.find({ user: user._id }).lean();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(cash, null, 2)
                }]
            };
        }
    );

    // Tool 7: get_transactions
    server.tool(
        'get_transactions',
        "Get historical purchase lots and recent AI audit actions (buys, sells, changes).",
        {
            limit: z.number().optional().describe("Number of transactions to return (default: 30)")
        },
        async ({ limit }) => {
            const data = await getTransactions(user._id, limit || 30);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(data, null, 2)
                }]
            };
        }
    );

    // ==========================================
    // WRITE / MANAGEMENT TOOLS (Auto-Tracking)
    // ==========================================

    // Tool 8: add_position (Record a Buy)
    server.tool(
        'add_position',
        "Add a new stock or record additional purchased shares for an existing stock in the user's portfolio. Supports US stocks and Israeli funds (TASE). Blends average cost automatically.",
        {
            symbol: z.string().describe("Stock ticker symbol or Israeli fund ID, e.g. 'NVDA', 'AAPL', '5131425'"),
            quantity: z.number().positive().describe("Number of shares bought (must be positive number)"),
            price: z.number().positive().optional().describe("Purchase price per share in USD. If omitted, current real-time market price will be used automatically."),
            name: z.string().optional().describe("Company or ETF name (optional, fetched automatically if omitted)"),
            broker: z.string().optional().describe("Broker or account name, e.g. 'Blink', 'IBI', 'Excellence' (default: 'Default')"),
            date: z.string().optional().describe("Purchase date in YYYY-MM-DD format (optional, defaults to today)")
        },
        async (args) => {
            try {
                const result = await addOrUpdatePosition(user._id, args, apiKeyContext);
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

    // Tool 9: sell_position (Record a Sale)
    server.tool(
        'sell_position',
        "Record a sale of shares or close an entire position in the user's portfolio. If quantity is omitted or equals/exceeds current shares, closes the position.",
        {
            symbol: z.string().describe("Stock ticker symbol to sell, e.g. 'NVDA'"),
            quantity: z.number().positive().optional().describe("Number of shares sold. If omitted or >= total shares, the position is completely closed."),
            broker: z.string().optional().describe("Broker or account name if position is held in a specific account")
        },
        async (args) => {
            try {
                const result = await sellPosition(user._id, args, apiKeyContext);
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

    // Tool 10: remove_position (Delete from Tracking)
    server.tool(
        'remove_position',
        "Remove a stock position completely from the user's portfolio tracking. Performs a safe soft-delete that can be undone.",
        {
            symbol: z.string().describe("Stock ticker symbol to remove, e.g. 'NVDA'"),
            broker: z.string().optional().describe("Broker name if position is in a specific broker"),
            confirm: z.boolean().optional().describe("Must be true to confirm removal")
        },
        async (args) => {
            try {
                const result = await removePosition(user._id, args, apiKeyContext);
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

    // Tool 11: update_position (Manual Correction)
    server.tool(
        'update_position',
        "Manually correct/update the total quantity of shares and average purchase price for an existing position.",
        {
            symbol: z.string().describe("Stock ticker symbol to update, e.g. 'NVDA'"),
            quantity: z.number().positive().describe("New total quantity of shares"),
            averagePrice: z.number().positive().describe("New average price per share in USD"),
            broker: z.string().optional().describe("Broker name")
        },
        async (args) => {
            try {
                const result = await updatePositionHolding(user._id, args, apiKeyContext);
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

    // Tool 12: import_positions (Bulk Import)
    server.tool(
        'import_positions',
        "Bulk import multiple positions at once into the user's portfolio.",
        {
            positions: z.array(z.object({
                symbol: z.string(),
                quantity: z.number().positive(),
                price: z.number().positive().optional(),
                name: z.string().optional(),
                broker: z.string().optional(),
                date: z.string().optional()
            })).describe("List of positions to import")
        },
        async (args) => {
            try {
                const result = await importPositions(user._id, args, apiKeyContext);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to import positions: ${err.message}` }]
                };
            }
        }
    );

    // Tool 13: update_cash_balance
    server.tool(
        'update_cash_balance',
        "Update cash or money market fund balance for a broker and currency.",
        {
            amount: z.number().describe("Total cash amount"),
            currency: z.enum(['USD', 'ILS', 'EUR']).optional().describe("Currency: 'USD', 'ILS', or 'EUR' (default: 'USD')"),
            broker: z.string().optional().describe("Broker or account name (default: 'Default')"),
            type: z.enum(['cash', 'money_market']).optional().describe("Type: 'cash' or 'money_market' (default: 'cash')"),
            name: z.string().optional().describe("Optional label or fund name")
        },
        async (args) => {
            try {
                const result = await updateCashBalance(user._id, args, apiKeyContext);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (err) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Failed to update cash balance: ${err.message}` }]
                };
            }
        }
    );

    return server;
}
