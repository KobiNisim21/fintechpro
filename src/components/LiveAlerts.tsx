import { TrendingUp, TrendingDown, Bell, Target, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveAlerts } from '@/context/LiveAlertsContext';

export function LiveAlerts() {
    const { alerts, loading, connected } = useLiveAlerts();

    return (
        <div className="mb-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-[var(--color-ios-success)]" />
                <h2 className="text-sm font-bold  text-[var(--color-ios-fg)] uppercase tracking-wider">Live Alerts</h2>
                {connected && (
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                )}
            </div>

            {/* Alerts List */}
            <div className="space-y-3">
                {loading ? (
                    // Loading skeleton
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-[var(--shadow-ios-card)] animate-pulse">
                            <div className="flex items-start gap-3">
                                <div className="w-4 h-4 bg-[var(--color-ios-secondary)]/20 rounded mt-1" />
                                <div className="flex-1">
                                    <div className="h-4 w-3/4 bg-[var(--color-ios-fg)]/20 rounded mb-2" />
                                    <div className="h-3 w-16 bg-[var(--color-ios-secondary)]/20 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : alerts.length === 0 ? (
                    // Empty state
                    <div className="p-4 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-[var(--shadow-ios-card)] text-center">
                        <Bell className="w-6 h-6 text-[var(--color-ios-secondary)]/60 mx-auto mb-2" />
                        <p className="text-sm font-bold text-[var(--color-ios-fg)]">No alerts yet</p>
                        <p className="text-xs font-medium text-[var(--color-ios-secondary)] mt-1">Price moves, 52-week lows &amp; earnings</p>
                    </div>
                ) : (
                    // Alert cards with animation
                    <AnimatePresence mode="sync">
                        {alerts.slice(0, 4).map((alert, index) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="p-3 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-[var(--shadow-ios-card)] hover:-translate-y-1 hover:shadow-[var(--shadow-ios-card)]Hover transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Icon based on alert type */}
                                    {alert.type === 'gain' && (
                                        <TrendingUp className="w-4 h-4 text-[var(--color-ios-success)] shrink-0" />
                                    )}
                                    {alert.type === 'loss' && (
                                        <TrendingDown className="w-4 h-4 text-[var(--color-ios-danger)] shrink-0" />
                                    )}
                                    {alert.type === 'news' && (
                                        <Bell className="w-4 h-4 text-[var(--color-ios-info)] shrink-0" />
                                    )}
                                    {alert.type === '52w-low' && (
                                        <Target className="w-4 h-4 text-[var(--color-clay-warning)] shrink-0" />
                                    )}
                                    {alert.type === 'earnings' && (
                                        <Calendar className="w-4 h-4 text-[var(--color-ios-info-alt)] shrink-0" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-[var(--color-ios-fg)] line-clamp-2 leading-snug">
                                            {alert.message}
                                        </p>

                                        {/* Ticker */}
                                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-ios-input)] text-[var(--color-ios-secondary)] font-bold tracking-wider uppercase shadow-none">
                                            ${alert.ticker}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
