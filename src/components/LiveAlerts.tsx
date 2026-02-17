import { TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveAlerts } from '@/context/LiveAlertsContext';

export function LiveAlerts() {
    const { alerts, loading, connected } = useLiveAlerts();

    return (
        <div className="mb-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Live Alerts</h2>
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
                        <div key={i} className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 animate-pulse">
                            <div className="flex items-start gap-3">
                                <div className="w-4 h-4 bg-white/10 rounded mt-1" />
                                <div className="flex-1">
                                    <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                                    <div className="h-3 w-16 bg-white/10 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : alerts.length === 0 ? (
                    // Empty state
                    <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-center">
                        <Bell className="w-6 h-6 text-white/20 mx-auto mb-2" />
                        <p className="text-sm text-white/40">No alerts yet</p>
                        <p className="text-xs text-white/30 mt-1">Alerts appear when prices move &gt;2%</p>
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
                                className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon based on alert type */}
                                    {alert.type === 'gain' && (
                                        <TrendingUp className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                                    )}
                                    {alert.type === 'loss' && (
                                        <TrendingDown className="w-4 h-4 text-rose-500 mt-1 shrink-0" />
                                    )}
                                    {alert.type === 'news' && (
                                        <Bell className="w-4 h-4 text-cyan-400 mt-1 shrink-0" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white/80 leading-relaxed">
                                            {alert.message}
                                        </p>
                                        {/* Ticker & Time */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium">
                                                ${alert.ticker}
                                            </span>
                                        </div>
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
