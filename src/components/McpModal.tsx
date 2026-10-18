import { useState, useEffect } from 'react';
import { Bot, Copy, Check, RefreshCw, Trash2, Key, Eye, EyeOff, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { mcpAPI, McpTokenStatus } from '../api/mcp';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';

export function McpModal() {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<McpTokenStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'curl'>('claude');

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

    useEffect(() => {
        if (open) {
            fetchStatus();
        }
    }, [open]);

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className="flex items-center justify-center gap-3 w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 text-slate-800 font-bold hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 group"
                >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                        <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold tracking-wide">AI Agent / MCP</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">
                        Live
                    </span>
                </button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-[32px] p-6 md:p-8 border border-slate-200/60 shadow-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold text-slate-800">
                                Model Context Protocol (MCP)
                            </DialogTitle>
                            <p className="text-xs text-slate-500 mt-0.5">
                                חבר את סוכן ה-AI שלך (Claude, Cursor, Antigravity) לתיק ההשקעות שלך
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Security Badge */}
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200/60 rounded-2xl text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                        <strong>גישת קריאה בלבד (Read-Only):</strong> סוכן ה-AI יוכל לתחקר נתונים ולבצע ניתוחים, ללא אפשרות לשנות או למחוק פוזיציות.
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                        <span className="ml-3 text-slate-500 text-sm">טוען הגדרות MCP...</span>
                    </div>
                ) : !status?.hasToken ? (
                    /* State: No Token Generated Yet */
                    <div className="text-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-500">
                            <Key className="w-8 h-8" />
                        </div>
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-bold text-slate-800">עדיין לא נוצר מפתח גישה לסוכן</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                צור מפתח MCP אישי ייעודי שיאפשר לסוכן שלך לתשאל בזמן אמת שווי תיק, רווח/הפסד, חדשות מניות ורשימות מעקב.
                            </p>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all"
                        >
                            {actionLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Key className="w-4 h-4" />
                            )}
                            צור מפתח MCP אישי
                        </button>
                    </div>
                ) : (
                    /* State: Token Exists */
                    <div className="space-y-6 mt-2">
                        {/* Access Token Box */}
                        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                                <span className="flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                                    מפתח הגישה האישי שלך (API Key):
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                        title={showKey ? 'הסתר' : 'הצג'}
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => copyToClipboard(status.token || '', 'token')}
                                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                                    >
                                        {copiedField === 'token' ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" />
                                                <span>הועתק!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3.5 h-3.5" />
                                                <span>העתק</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="font-mono text-xs bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all text-slate-800">
                                {showKey ? status.token : `${status.token?.slice(0, 10)}••••••••••••••••••••••••••••`}
                            </div>
                        </div>

                        {/* Remote SSE Connection URL */}
                        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                                <span>קישור התחברות ישיר (Remote MCP SSE URL):</span>
                                <button
                                    onClick={() => copyToClipboard(status.sseUrl || '', 'sseUrl')}
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    {copiedField === 'sseUrl' ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>הועתק!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>העתק URL</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="font-mono text-xs bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all text-slate-700">
                                {status.sseUrl}
                            </div>
                        </div>

                        {/* Integration Guides (Tabs) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    הגדרות מהירות עבור ה-AI שלך:
                                </span>
                                <div className="flex bg-slate-200/60 p-0.5 rounded-xl text-xs">
                                    <button
                                        onClick={() => setActiveTab('claude')}
                                        className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'claude'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Claude Desktop
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('cursor')}
                                        className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'cursor'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Cursor / VS Code
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('curl')}
                                        className={`px-3 py-1 rounded-lg font-medium transition-all ${activeTab === 'curl'
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        cURL / HTTP
                                    </button>
                                </div>
                            </div>

                            {/* Tab 1: Claude Desktop */}
                            {activeTab === 'claude' && (
                                <div className="relative">
                                    <p className="text-xs text-slate-500 mb-2">
                                        הדבק את הקוד הבא בתוך קובץ <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">claude_desktop_config.json</code>:
                                    </p>
                                    <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed">
                                        {claudeConfig}
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(claudeConfig, 'claude')}
                                        className="absolute top-8 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow"
                                    >
                                        {copiedField === 'claude' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>העתק קונפיגורציה</span>
                                    </button>
                                </div>
                            )}

                            {/* Tab 2: Cursor */}
                            {activeTab === 'cursor' && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                                    <p className="font-semibold text-slate-800">הוראות התחברות ב-Cursor:</p>
                                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                                        <li>פתח את <strong>Settings → Features → MCP</strong>.</li>
                                        <li>לחץ על <strong>+ Add New MCP Server</strong>.</li>
                                        <li>בחר Type: <span className="font-mono bg-white px-1.5 py-0.5 rounded border">sse</span>.</li>
                                        <li>בשדה Name הזן: <span className="font-mono bg-white px-1.5 py-0.5 rounded border">fintechpro</span>.</li>
                                        <li>בשדה Server URL הדבק את ה-Remote MCP SSE URL למעלה.</li>
                                    </ol>
                                </div>
                            )}

                            {/* Tab 3: cURL */}
                            {activeTab === 'curl' && (
                                <div className="relative">
                                    <p className="text-xs text-slate-500 mb-2">
                                        בדיקת תקינות באמצעות cURL (קריאה ל-get_portfolio_summary):
                                    </p>
                                    <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed">
                                        {curlSnippet}
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(curlSnippet, 'curl')}
                                        className="absolute top-8 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow"
                                    >
                                        {copiedField === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>העתק cURL</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tools List Preview */}
                        <div className="pt-2 border-t border-slate-200/60">
                            <span className="text-xs font-bold text-slate-700 block mb-2">
                                כלים זמינים לסוכן ה-AI שלך (5 כלים):
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                    <span className="font-mono font-bold text-emerald-600">get_portfolio_summary</span>
                                    <p className="text-slate-500 text-[11px] mt-0.5">שווי כולל, רווח/הפסד כולל ($ ו-%), ומספר מניות.</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                    <span className="font-mono font-bold text-emerald-600">get_positions</span>
                                    <p className="text-slate-500 text-[11px] mt-0.5">כל המניות בתיק, כמויות, מחירי קנייה ושוק, ומשקלים.</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                    <span className="font-mono font-bold text-emerald-600">get_position_details</span>
                                    <p className="text-slate-500 text-[11px] mt-0.5">פירוט עמוק על מניה מסוימת והיסטוריית עסקאות (Lots).</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                    <span className="font-mono font-bold text-emerald-600">get_portfolio_news</span>
                                    <p className="text-slate-500 text-[11px] mt-0.5">חדשות מהשוק הקשורות למניות שמוחזקות בתיק.</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200 md:col-span-2">
                                    <span className="font-mono font-bold text-emerald-600">get_watchlist</span>
                                    <p className="text-slate-500 text-[11px] mt-0.5">מניות הנמצאות ברשימת המעקב והציטוטים הנוכחיים שלהן.</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
                            <button
                                onClick={handleGenerate}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                                <span>ייצר מפתח חדש (מחליף קיים)</span>
                            </button>

                            <button
                                onClick={handleRevoke}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 transition-colors font-medium"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>בטל מפתח גישה</span>
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
