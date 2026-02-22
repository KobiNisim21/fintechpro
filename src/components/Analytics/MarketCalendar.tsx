import { useEffect, useState, useMemo } from 'react';
import { Calendar, AlertTriangle, Scissors, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { stocksAPI, MarketCalendarData } from '@/api/stocks';
import { usePortfolio } from '@/context/PortfolioContext';

type Tab = 'events' | 'holidays' | 'splits';

const COUNTRY_FLAGS: Record<string, string> = {
    US: '🇺🇸',
    IL: '🇮🇱',
};

const CATEGORY_COLORS: Record<string, string> = {
    fed: 'text-amber-400',
    inflation: 'text-rose-400',
    employment: 'text-cyan-400',
    gdp: 'text-emerald-400',
    central_bank: 'text-violet-400',
};

function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function ImportanceStars({ level }: { level: number }) {
    return (
        <span className="flex gap-0.5">
            {[1, 2, 3].map(i => (
                <Star
                    key={i}
                    className={`w-3 h-3 ${i <= level ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`}
                />
            ))}
        </span>
    );
}

export function MarketCalendar() {
    const { positions } = usePortfolio();
    const [data, setData] = useState<MarketCalendarData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('events');

    useEffect(() => {
        const fetchCalendar = async () => {
            try {
                setLoading(true);
                const symbols = positions.map(p => p.symbol);
                const result = await stocksAPI.getMarketCalendar(symbols);
                setData(result);
            } catch (err) {
                console.error('Failed to fetch market calendar:', err);
            } finally {
                setLoading(false);
            }
        };

        if (positions.length > 0) {
            fetchCalendar();
        }
    }, [positions.length]);

    // Filter holidays to only future ones
    const futureHolidays = useMemo(() => {
        if (!data?.marketHolidays) return [];
        const today = new Date().toISOString().split('T')[0];
        return data.marketHolidays
            .filter(h => h.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 15);
    }, [data?.marketHolidays]);

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'events', label: 'Economic Events', count: data?.economicEvents?.length || 0 },
        { key: 'holidays', label: 'Market Holidays', count: futureHolidays.length },
        { key: 'splits', label: 'Stock Splits', count: data?.stockSplits?.length || 0 },
    ];

    return (
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white/90">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    Market Calendar
                </CardTitle>

                {/* Tab Bar */}
                <div className="flex gap-1 mt-3 p-1 bg-white/5 rounded-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === tab.key
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className="ml-1.5 text-[10px] opacity-60">({tab.count})</span>
                            )}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Economic Events Tab */}
                        {activeTab === 'events' && (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                                {(data?.economicEvents || []).length === 0 ? (
                                    <p className="text-center text-white/30 text-sm py-8">No upcoming events</p>
                                ) : (
                                    (data?.economicEvents || []).map((event, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                                        >
                                            {/* Date */}
                                            <div className="flex flex-col items-center min-w-[52px]">
                                                <span className="text-[10px] text-white/30 uppercase">{formatWeekday(event.date)}</span>
                                                <span className="text-sm font-semibold text-white/70">{formatDate(event.date)}</span>
                                            </div>

                                            {/* Flag */}
                                            <span className="text-lg">{COUNTRY_FLAGS[event.country] || '🌐'}</span>

                                            {/* Importance */}
                                            <ImportanceStars level={event.importance} />

                                            {/* Event Name */}
                                            <span className={`text-sm font-medium flex-1 ${CATEGORY_COLORS[event.category] || 'text-white/80'}`}>
                                                {event.event}
                                            </span>

                                            {/* Time */}
                                            <span className="text-[10px] text-white/25 hidden sm:block">{event.time} ET</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Market Holidays Tab */}
                        {activeTab === 'holidays' && (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                                {futureHolidays.length === 0 ? (
                                    <p className="text-center text-white/30 text-sm py-8">No upcoming market holidays</p>
                                ) : (
                                    futureHolidays.map((holiday, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex flex-col items-center min-w-[52px]">
                                                <span className="text-[10px] text-white/30 uppercase">{formatWeekday(holiday.date)}</span>
                                                <span className="text-sm font-semibold text-white/70">{formatDate(holiday.date)}</span>
                                            </div>

                                            <AlertTriangle className="w-4 h-4 text-rose-400" />

                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-rose-300">{holiday.name}</span>
                                                <span className="text-[10px] text-white/25 ml-2">
                                                    {holiday.tradingHour === 'closed' ? 'Exchange Closed' : holiday.tradingHour}
                                                </span>
                                            </div>

                                            <span className="text-[10px] text-white/20 uppercase">{holiday.exchange}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Stock Splits Tab */}
                        {activeTab === 'splits' && (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                                {(data?.stockSplits || []).length === 0 ? (
                                    <div className="text-center py-8">
                                        <Scissors className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                        <p className="text-white/30 text-sm">No upcoming splits for your holdings</p>
                                    </div>
                                ) : (
                                    (data?.stockSplits || []).map((split, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex flex-col items-center min-w-[52px]">
                                                <span className="text-[10px] text-white/30 uppercase">{formatWeekday(split.date)}</span>
                                                <span className="text-sm font-semibold text-white/70">{formatDate(split.date)}</span>
                                            </div>

                                            <Scissors className="w-4 h-4 text-violet-400" />

                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-violet-300">{split.symbol}</span>
                                                <span className="text-xs text-white/40 ml-2">{split.description}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
