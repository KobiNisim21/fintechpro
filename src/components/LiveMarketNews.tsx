import { Newspaper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarketNews, usePaginatedNews } from '@/context/MarketNewsContext';
import { useEffect, useState, useRef } from 'react';

export function LiveMarketNews() {
    const { currentPage, setCurrentPage, totalPages, loading, connected, newItemsCount, clearNewCount, news } = useMarketNews();
    const paginatedNews = usePaginatedNews();
    const [direction, setDirection] = useState(0);
    const prevPageRef = useRef(currentPage);

    // Track direction for slide animation
    useEffect(() => {
        setDirection(currentPage > prevPageRef.current ? 1 : -1);
        prevPageRef.current = currentPage;
    }, [currentPage]);

    // Auto-rotate pages every 10 seconds
    useEffect(() => {
        if (totalPages <= 1) return;

        const interval = setInterval(() => {
            const nextPage = (currentPage + 1) % totalPages;
            setCurrentPage(nextPage);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [totalPages, currentPage, setCurrentPage]);

    // Clear new items count when user interacts with pagination
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        clearNewCount();
    };

    // Handle ticker click - scroll to stock card in portfolio
    const handleTickerClick = (ticker: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const stockCard = document.querySelector(`[data-ticker="${ticker}"]`);
        if (stockCard) {
            stockCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            stockCard.classList.add('ring-2', 'ring-cyan-400');
            setTimeout(() => {
                stockCard.classList.remove('ring-2', 'ring-cyan-400');
            }, 2000);
        }
    };

    return (
        <div className="mt-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Market News</h2>
                {connected && (
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-emerald-400">LIVE</span>
                    </div>
                )}
                {newItemsCount > 0 && (
                    <button
                        onClick={() => { setCurrentPage(0); clearNewCount(); }}
                        className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full hover:bg-cyan-500/30 transition-colors"
                    >
                        +{newItemsCount} new
                    </button>
                )}
            </div>

            {/* News Items Container - Fixed height for smooth transitions */}
            <div className="min-h-[380px] overflow-hidden relative">
                {loading ? (
                    // Loading skeleton
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 animate-pulse">
                                <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                                <div className="h-4 w-full bg-white/10 rounded mb-1" />
                                <div className="h-4 w-3/4 bg-white/10 rounded" />
                            </div>
                        ))}
                    </div>
                ) : paginatedNews.length === 0 ? (
                    // Empty state
                    <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-center">
                        <Newspaper className="w-8 h-8 text-white/20 mx-auto mb-2" />
                        <p className="text-sm text-white/40">No news matching your portfolio yet</p>
                        <p className="text-xs text-white/30 mt-1">News will appear when sources mention $TICKER symbols in your holdings</p>
                    </div>
                ) : (
                    // News cards with smooth slide animation
                    <AnimatePresence mode="sync">
                        <motion.div
                            key={`page-${currentPage}`}
                            initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction < 0 ? 50 : -50 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-3"
                        >
                            {paginatedNews.map((item, index) => (
                                <motion.div
                                    key={item.id || `item-${index}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: index * 0.05 }}
                                    className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                                    onClick={() => item.link && window.open(item.link, '_blank')}
                                >
                                    <div className="flex flex-col gap-2">
                                        {/* Header: Source & Time */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-cyan-400">{item.source || 'Unknown'}</span>
                                            <span className="text-xs text-white/40">{item.relativeTime || 'recently'}</span>
                                        </div>

                                        {/* Content - Headline first, then summary/content */}
                                        <p className="text-sm font-medium text-white/90 leading-relaxed line-clamp-2">
                                            {item.headline || item.content || '(No content)'}
                                        </p>
                                        {item.summary && item.summary !== item.headline && (
                                            <p className="text-xs text-white/50 line-clamp-1 mt-1">
                                                {item.summary}
                                            </p>
                                        )}

                                        {/* Tickers badges - Clickable */}
                                        {item.tickers && item.tickers.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {item.tickers.map(ticker => (
                                                    <button
                                                        key={ticker}
                                                        onClick={(e) => handleTickerClick(ticker, e)}
                                                        className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/40 transition-colors"
                                                    >
                                                        ${ticker}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {/* Pagination Dots with smooth transitions */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-4 py-3 px-4 bg-white/5 rounded-xl border border-white/10">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <motion.div
                            key={i}
                            onClick={() => handlePageChange(i)}
                            role="button"
                            tabIndex={0}
                            animate={{
                                width: i === currentPage ? 28 : 10,
                                backgroundColor: i === currentPage ? '#22d3ee' : 'rgba(255,255,255,0.3)',
                                boxShadow: i === currentPage ? '0 0 12px rgba(34,211,238,0.5)' : 'none'
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            style={{
                                height: '10px',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                            aria-label={`Go to page ${i + 1} of ${totalPages}`}
                        />
                    ))}
                    <span className="text-xs text-white/50 ml-2 font-medium">
                        {currentPage + 1}/{totalPages}
                    </span>
                </div>
            )}

            {/* Total items indicator */}
            {news.length > 0 && (
                <p className="text-xs text-white/30 text-center mt-2">
                    Showing {paginatedNews.length} of {news.length} items
                </p>
            )}
        </div>
    );
}
