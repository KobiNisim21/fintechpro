import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Copy, Check, RefreshCw, Trash2, Key, Eye, EyeOff, Sparkles, ShieldCheck, X } from 'lucide-react';
import { mcpAPI, McpTokenStatus } from '../api/mcp';

export function McpModal() {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<McpTokenStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'curl'>('claude');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            fetchStatus();
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const data = await mcpAPI.getStatus();
            setStatus(data);
        } catch (err) {
            console.error('Failed to load MCP status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setActionLoading(true);
        try {
            const data = await mcpAPI.generateToken();
            setStatus(data);
            setShowKey(true);
        } catch (err) {
            console.error('Failed to generate token:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm('האם אתה בטוח שברצונך לבטל את מפתח ה-MCP? סוכני AI שמחוברים כרגע יאבדו גישה.')) {
            return;
        }
        setActionLoading(true);
        try {
            await mcpAPI.revokeToken();
            setStatus(null);
            setShowKey(false);
        } catch (err) {
            console.error('Failed to revoke token:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2500);
    };

    const claudeConfig = status?.token ? JSON.stringify({
        mcpServers: {
            fintechpro: {
                url: status.sseUrl || `https://fintechpro.vercel.app/api/mcp/sse?token=${status.token}`,
                headers: {
                    Authorization: `Bearer ${status.token}`
                }
            }
        }
    }, null, 2) : '';

    const curlSnippet = status?.token ? `curl -X POST "${status.httpUrl || 'https://fintechpro.vercel.app/api/mcp'}" \\
  -H "Authorization: Bearer ${status.token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_portfolio_summary"
    }
  }'` : '';

    return (
        <>
            {/* Sidebar / Menu Button */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center justify-between gap-3 w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 text-slate-800 font-bold hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 group"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/30 group-hover:scale-105 transition-transform shrink-0">
                        <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold tracking-wide truncate">AI Agent / MCP</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 shrink-0">
                    Live
                </span>
            </button>

            {/* Modal Portal */}
            {open && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto overflow-x-hidden animate-fadeIn"
                    onClick={() => setOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        dir="rtl"
                        className="relative w-full max-w-xl bg-white/95 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl border border-slate-200/80 my-auto max-h-[90vh] overflow-y-auto overflow-x-hidden text-slate-800 box-border animate-scaleIn custom-scrollbar"
                    >
                        {/* Close Button (placed top-left because dir="rtl") */}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="absolute top-4 left-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
                            aria-label="סגור"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4 pl-8">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 dir="ltr" className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight text-right">
                                    Model Context Protocol (MCP)
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                                    חיבור סוכן AI אישי (<span dir="ltr">Claude, Cursor, ChatGPT</span>) לתיק ההשקעות שלך
                                </p>
                            </div>
                        </div>

                        {/* Read-Only Security Badge */}
                        <div className="flex items-start sm:items-center gap-2.5 p-3 sm:p-3.5 bg-emerald-50/90 border border-emerald-200/70 rounded-2xl text-xs text-emerald-900 leading-relaxed mb-5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                            <div>
                                <span className="font-bold">הרשאת קריאה בלבד (<span dir="ltr">Read-Only</span>): </span>
                                <span>הסוכן מקבל גישה לצפייה וניתוח בלבד, ואינו יכול לשנות או למחוק נתונים.</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                                <span className="mr-3 text-slate-500 text-sm">טוען הגדרות MCP...</span>
                            </div>
                        ) : !status?.hasToken ? (
                            /* State 1: No Token Generated Yet */
                            <div className="text-center py-6 sm:py-8 space-y-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-500">
                                    <Key className="w-8 h-8 text-emerald-600" />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h3 className="text-lg font-bold text-slate-800">עדיין לא נוצר מפתח גישה לסוכן</h3>
                                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                                        צור מפתח MCP אישי ייעודי שיאפשר לסוכן שלך לתשאל בזמן אמת שווי תיק, מחירי מניות, רווח/הפסד וחדשות.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={actionLoading}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all text-sm"
                                >
                                    {actionLoading ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Key className="w-4 h-4" />
                                    )}
                                    <span>צור מפתח MCP אישי</span>
                                </button>
                            </div>
                        ) : (
                            /* State 2: Token Exists */
                            <div className="space-y-4 sm:space-y-5">
                                {/* API Key Box */}
                                <div className="p-3.5 sm:p-4 bg-slate-50/90 rounded-2xl border border-slate-200/70 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                        <span className="flex items-center gap-1.5">
                                            <Key className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                            <span>מפתח גישה אישי (<span dir="ltr">API Key</span>):</span>
                                        </span>
                                        <div className="flex items-center gap-2" dir="ltr">
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                title={showKey ? 'הסתר' : 'הצג'}
                                            >
                                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(status.token || '', 'token')}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] transition-colors shadow-2xs shrink-0"
                                            >
                                                {copiedField === 'token' ? (
                                                    <>
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                        <span>הועתק!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3" />
                                                        <span>העתק</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div dir="ltr" className="font-mono text-xs bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all text-slate-800 text-left">
                                        {showKey ? status.token : `${status.token?.slice(0, 10)}••••••••••••••••••••••••••••`}
                                    </div>
                                </div>

                                {/* Remote SSE Connection URL */}
                                <div className="p-3.5 sm:p-4 bg-slate-50/90 rounded-2xl border border-slate-200/70 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                        <span>כתובת חיבור ישירה (<span dir="ltr">Remote SSE URL</span>):</span>
                                        <button
                                            type="button"
                                            dir="ltr"
                                            onClick={() => copyToClipboard(status.sseUrl || '', 'sseUrl')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] transition-colors shadow-2xs shrink-0"
                                        >
                                            {copiedField === 'sseUrl' ? (
                                                <>
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span>הועתק!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    <span>העתק URL</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div dir="ltr" className="font-mono text-[11px] sm:text-xs bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all text-slate-700 text-left">
                                        {status.sseUrl}
                                    </div>
                                </div>

                                {/* Quick Config Snippets */}
                                <div className="space-y-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800">
                                            הגדרות מהירות לפי סוג ה-AI:
                                        </span>
                                        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs gap-1 self-start sm:self-auto" dir="ltr">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('claude')}
                                                className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'claude'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                Claude Desktop
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('cursor')}
                                                className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'cursor'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                Cursor
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('curl')}
                                                className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'curl'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                cURL / HTTP
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab 1: Claude Desktop */}
                                    {activeTab === 'claude' && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>הדבק בקובץ <code dir="ltr" className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">claude_desktop_config.json</code>:</span>
                                                <button
                                                    type="button"
                                                    dir="ltr"
                                                    onClick={() => copyToClipboard(claudeConfig, 'claude')}
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                                                >
                                                    {copiedField === 'claude' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>העתק JSON</span>
                                                </button>
                                            </div>
                                            <div dir="ltr" className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800">
                                                <pre className="p-3.5 text-emerald-400 font-mono text-[11px] sm:text-xs overflow-x-auto leading-relaxed text-left max-h-48 custom-scrollbar">
                                                    {claudeConfig}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 2: Cursor */}
                                    {activeTab === 'cursor' && (
                                        <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 text-right">
                                            <p className="font-bold text-slate-800">הוראות חיבור ב-Cursor / VS Code:</p>
                                            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                                                <li>פתח ב-Cursor את <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Settings → Features → MCP</span>.</li>
                                                <li>לחץ על <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">+ Add New MCP Server</span>.</li>
                                                <li>בחר סוג (<span dir="ltr">Type</span>): <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">sse</span>.</li>
                                                <li>הזן שם (<span dir="ltr">Name</span>): <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">fintechpro</span>.</li>
                                                <li>הדבק את כתובת ה-SSE URL המופיעה למעלה.</li>
                                            </ol>
                                        </div>
                                    )}

                                    {/* Tab 3: cURL */}
                                    {activeTab === 'curl' && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>קריאת בדיקה ישירה (<span dir="ltr">HTTP JSON-RPC</span>):</span>
                                                <button
                                                    type="button"
                                                    dir="ltr"
                                                    onClick={() => copyToClipboard(curlSnippet, 'curl')}
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                                                >
                                                    {copiedField === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>העתק cURL</span>
                                                </button>
                                            </div>
                                            <div dir="ltr" className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800">
                                                <pre className="p-3.5 text-emerald-400 font-mono text-[11px] sm:text-xs overflow-x-auto leading-relaxed text-left max-h-48 custom-scrollbar">
                                                    {curlSnippet}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tools List Preview */}
                                <div className="pt-2 border-t border-slate-200/70 space-y-2">
                                    <span className="text-xs font-bold text-slate-800 block">
                                        כלים זמינים לסוכן ה-AI (5 כלים):
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <div dir="ltr" className="font-mono font-bold text-emerald-600 text-left">get_portfolio_summary</div>
                                            <p className="text-slate-500 text-[11px] mt-1 text-right">שווי כולל, רווח/הפסד מצטבר ($ ו-%), והמניות המובילות.</p>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <div dir="ltr" className="font-mono font-bold text-emerald-600 text-left">get_positions</div>
                                            <p className="text-slate-500 text-[11px] mt-1 text-right">כל המניות בתיק, מחירי שוק חיים, מחירי קנייה ומשקלים.</p>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <div dir="ltr" className="font-mono font-bold text-emerald-600 text-left">get_position_details</div>
                                            <p className="text-slate-500 text-[11px] mt-1 text-right">פירוט עמוק על מניה ספציפית והיסטוריית רכישות (<span dir="ltr">Lots</span>).</p>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <div dir="ltr" className="font-mono font-bold text-emerald-600 text-left">get_portfolio_news</div>
                                            <p className="text-slate-500 text-[11px] mt-1 text-right">חדשות כלכליות ממוקדות למניות שמוחזקות בתיק שלך.</p>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 sm:col-span-2">
                                            <div dir="ltr" className="font-mono font-bold text-emerald-600 text-left">get_watchlist</div>
                                            <p className="text-slate-500 text-[11px] mt-1 text-right">מניות מתוך רשימת המעקב האישית והציטוטים הנוכחיים שלהן.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/70">
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors font-medium order-2 sm:order-1"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                                        <span>ייצר מפתח חדש (מחליף קיים)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRevoke}
                                        disabled={actionLoading}
                                        className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 transition-colors font-semibold order-1 sm:order-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>בטל מפתח גישה</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
