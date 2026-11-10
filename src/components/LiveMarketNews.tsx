import { t, useLanguage, relativeTime } from '@/i18n';
import { Newspaper } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMarketNews, usePaginatedNews } from '@/context/MarketNewsContext';
import { useEffect, useState, useRef } from 'react';

export function LiveMarketNews() {
    useLanguage();
    const { currentPage, setCurrentPage, totalPages, loading, connected, newItemsCount, clearNewCount, news } = useMarketNews();
    const paginatedNews = usePaginatedNews();
    const reduceMotion = useReducedMotion();
    const [direction, setDirection] = useState(0);
    const prevPageRef = useRef(currentPage);

    // Track direction for slide animation
    useEffect(() => {
        setDirection(currentPage > prevPageRef.current ? 1 : -1);
        prevPageRef.current = currentPage;
    }, [currentPage]);

    // Auto-rotate pages every 10 seconds
    useEffect(() => {
        if (totalPages <= 1 || reduceMotion) return;

        const interval = setInterval(() => {
            const nextPage = (currentPage + 1) % totalPages;
            setCurrentPage(nextPage);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [totalPages, currentPage, setCurrentPage, reduceMotion]);

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
        <div className="live-market-news mt-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-5 h-5 text-[var(--color-ios-info)]" />
                <h2 className="text-sm font-bold  text-[var(--color-ios-fg)] uppercase tracking-wider">{t("Market News")}</h2>
                {connected && (
                    <div className="flex items-center gap-1.5 ms-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-600">{t("LIVE")}</span>
                    </div>
                )}
                {newItemsCount > 0 && (
                    <button
                        onClick={() => { setCurrentPage(0); clearNewCount(); }}
                        className="ms-auto text-xs bg-[var(--color-ios-info)]/20 text-[var(--color-ios-info)] font-bold px-2 py-0.5 rounded-full hover:bg-[var(--color-ios-info)]/30 transition-colors"
                    >
                        +{newItemsCount} {t(" new")}</button>
                )}
            </div>

            <p className="text-xs text-slate-500 mb-3">{t("External news is shown in its original language.")}</p>
            {/* News Items Container - Fixed height for smooth transitions */}
            <div className="min-h-[380px] overflow-hidden relative">
                {loading ? (
                    // Loading skeleton
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-[24px] bg-white/80 border border-white/60 backdrop-blur-xl animate-pulse shadow-[var(--shadow-ios-card)]">
                                <div className="h-3 w-24 bg-[var(--color-ios-secondary)]/40 rounded mb-2" />
                                <div className="h-4 w-full bg-[var(--color-ios-fg)]/20 rounded mb-1" />
                                <div className="h-4 w-3/4 bg-[var(--color-ios-fg)]/20 rounded" />
                            </div>
                        ))}
                    </div>
                ) : paginatedNews.length === 0 ? (
                    // Empty state
                    <div className="p-6 rounded-[24px] bg-white/80 border border-white/60 backdrop-blur-xl text-center shadow-[var(--shadow-ios-card)]">
                        <Newspaper className="w-8 h-8 text-[var(--color-ios-secondary)] mx-auto mb-2 opacity-60" />
                        <p className="text-sm font-bold text-[var(--color-ios-fg)]">{t("No news matching your portfolio yet")}</p>
                        <p className="text-xs font-medium text-[var(--color-ios-secondary)] mt-1">{t("News will appear when sources mention $TICKER symbols in your holdings")}</p>
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
                                    className="p-4 rounded-[24px] bg-white/80 border border-white/60 backdrop-blur-xl hover:-translate-y-1 hover:shadow-[var(--shadow-ios-card)]Hover shadow-[var(--shadow-ios-card)] transition-all cursor-pointer"
                                    onClick={() => item.link && window.open(item.link, '_blank')}
                                >
                                    <div className="flex flex-col gap-2">
                                        {/* Header: Source & Time */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[12px] font-bold  text-[var(--color-ios-info)]">{item.source || t("Unknown")}</span>
                                            <span className="text-[11px] font-bold text-[var(--color-ios-secondary)]">{relativeTime(item.pubDate)}</span>
                                        </div>

                                        {/* Content - Headline first, then summary/content */}
                                        <p className="text-[14px] font-bold text-[var(--color-ios-fg)] leading-relaxed line-clamp-2">
                                            {item.headline || item.content || t("(No content)")}
                                        </p>
                                        {item.summary && item.summary !== item.headline && (
                                            <p className="text-xs font-medium text-[var(--color-ios-secondary)] line-clamp-1 mt-1">
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
                                                        className="text-[10px] px-2 py-0.5 rounded-[8px] bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 transition-colors"
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
                <div className="news-pagination mt-3 border-t border-line pt-2">
                    <div className="news-pagination-controls">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                            type="button"
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className="news-page-button"
                            aria-current={i === currentPage ? 'page' : undefined}
                            aria-label={t("Go to page {0} of {1}", [i + 1, totalPages])}
                        >
                        <motion.span
                            animate={{
                                width: i === currentPage ? 28 : 10,
                                backgroundColor: i === currentPage ? 'var(--color-ios-info)' : 'rgba(74, 70, 81, 0.2)',
                                boxShadow: i === currentPage ? '0 0 12px rgba(14, 165, 233, 0.3)' : 'none'
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            style={{
                                height: '10px',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                            aria-hidden="true"
                        />
                        </button>
                    ))}
                    </div>
                    <span dir="ltr" className="news-page-count text-caption text-secondary tabular-nums">
                        {currentPage + 1}/{totalPages}
                    </span>
                </div>
            )}

            {/* Total items indicator */}
            {news.length > 0 && (
                <p className="text-[11px] font-bold text-[var(--color-ios-secondary)] text-center mt-2">
                    {t("Showing ")}{paginatedNews.length} {t(" of ")}{news.length} {t(" items")}</p>
            )}
        </div>
    );
}
