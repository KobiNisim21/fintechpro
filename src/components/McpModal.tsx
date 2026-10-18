import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { 
    Bot, Copy, Check, RefreshCw, Trash2, Key, Eye, EyeOff, Sparkles, 
    ShieldCheck, X, Undo2, AlertTriangle, Plus, Clock, ExternalLink, 
    ShieldAlert, Lock, CheckCircle2, ChevronRight, Layers, History, Wrench
} from 'lucide-react';
import { mcpAPI, ApiKeyItem, CreateKeyResponse, AuditLogItem } from '../api/mcp';

export function McpModal() {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [serverUrl, setServerUrl] = useState('https://fintechpro.vercel.app/api/mcp');
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'keys' | 'claude' | 'desktop' | 'audit' | 'tools'>('keys');
    
    // One-time secret key display modal
    const [newKeyData, setNewKeyData] = useState<CreateKeyResponse | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [createName, setCreateName] = useState('Claude');
    const [createScope, setCreateScope] = useState<'read' | 'write'>('read');
    const [createExpires, setCreateExpires] = useState<string>('never');
    
    // Test connection state
    const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

    // Copying state
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Undo action loading
    const [undoingId, setUndoingId] = useState<string | null>(null);

    const [, startTransition] = useTransition();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            loadData();
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
                if (showCreateDialog) {
                    setShowCreateDialog(false);
                } else if (newKeyData) {
                    setNewKeyData(null);
                } else {
                    setOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, showCreateDialog, newKeyData]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [keysRes, auditRes] = await Promise.all([
                mcpAPI.getKeys(),
                mcpAPI.getAuditLogs()
            ]);
            setKeys(keysRes.keys || []);
            if (keysRes.serverUrl) setServerUrl(keysRes.serverUrl);
            setAuditLogs(auditRes || []);
        } catch (err) {
            console.error('Failed to load MCP data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const expiresInDays = createExpires === '30' ? 30 : createExpires === '90' ? 90 : null;
            const scopes = createScope === 'write' ? ['read', 'write'] : ['read'];

            const created = await mcpAPI.createKey({
                name: createName.trim() || 'Claude',
                scopes,
                expiresInDays
            });

            // Add to list and open one-time reveal modal
            setKeys(prev => [created, ...prev]);
            setNewKeyData(created);
            setShowCreateDialog(false);
            setCreateName('Claude');
            setCreateScope('read');
            setCreateExpires('never');
        } catch (err: any) {
            alert('שגיאה ביצירת מפתח: ' + (err.message || 'שגיאת שרת'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeKey = async (keyItem: ApiKeyItem) => {
        if (!confirm(`האם אתה בטוח שברצונך לבטל את המפתח "${keyItem.name}" (${keyItem.keyPrefix})? סוכן AI המשתמש בו יאבד גישה מידית.`)) {
            return;
        }

        setActionLoading(true);
        try {
            await mcpAPI.revokeKey(keyItem._id);
            setKeys(prev => prev.map(k => k._id === keyItem._id ? { ...k, revoked: true } : k));
        } catch (err: any) {
            alert('שגיאה בביטול מפתח: ' + (err.message || 'שגיאת שרת'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleUndoAudit = async (logItem: AuditLogItem) => {
        if (!confirm(`האם לשחזר את הפעולה: "${logItem.details}"?`)) {
            return;
        }

        setUndoingId(logItem._id);
        try {
            const res = await mcpAPI.undoAudit(logItem._id);
            alert(res.message || 'הפעולה שוחזרה בהצלחה!');
            // Update local state
            setAuditLogs(prev => prev.map(l => l._id === logItem._id ? { ...l, undone: true } : l));
        } catch (err: any) {
            alert('שגיאה בשחזור פעולה: ' + (err.response?.data?.message || err.message));
        } finally {
            setUndoingId(null);
        }
    };

    const copyToClipboard = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2500);
    };

    const formatDate = (isoString?: string | null) => {
        if (!isoString) return 'טרם שומש';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    // Configuration snippet for Claude Desktop
    const claudeDesktopSnippet = JSON.stringify({
        mcpServers: {
            fintechpro: {
                url: `${serverUrl}/sse`,
                headers: {
                    Authorization: "Bearer <YOUR_API_KEY>"
                }
            }
        }
    }, null, 2);

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
                    <span className="text-sm font-semibold tracking-wide truncate">חיבור ל-Claude / AI</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 shrink-0">
                    MCP Live
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
                        className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-2xl border border-slate-200/80 my-auto max-h-[92vh] overflow-y-auto overflow-x-hidden text-slate-800 box-border animate-scaleIn custom-scrollbar"
                    >
                        {/* Close Button */}
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
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                                        חיבור סוכן AI לתיק (<span dir="ltr">MCP</span>)
                                    </h2>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full" dir="ltr">
                                        v2025-06-18
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                                    חיבור מאובטח ל-Claude, Cursor וסוכני AI נוספים עם בקרת הרשאות ויומן שינויים מלא.
                                </p>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl mb-5 overflow-x-auto text-xs font-semibold custom-scrollbar">
                            <button
                                type="button"
                                onClick={() => setActiveTab('keys')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'keys'
                                        ? 'bg-white text-slate-800 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Key className="w-3.5 h-3.5 text-emerald-600" />
                                <span>מפתחות גישה</span>
                                {keys.filter(k => !k.revoked).length > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                        {keys.filter(k => !k.revoked).length}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('claude')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'claude'
                                        ? 'bg-white text-slate-800 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Bot className="w-3.5 h-3.5 text-blue-600" />
                                <span>חיבור ל-Claude</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('desktop')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'desktop'
                                        ? 'bg-white text-slate-800 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Cursor / Desktop</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('audit')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'audit'
                                        ? 'bg-white text-slate-800 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <History className="w-3.5 h-3.5 text-amber-600" />
                                <span>פעולות AI & שחזור</span>
                                {auditLogs.length > 0 && (
                                    <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                        {auditLogs.length}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('tools')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                                    activeTab === 'tools'
                                        ? 'bg-white text-slate-800 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Wrench className="w-3.5 h-3.5 text-slate-600" />
                                <span>כלים זמינים</span>
                            </button>
                        </div>

                        {/* Server URL Bar (Visible on all tabs) */}
                        <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-slate-700 shrink-0">כתובת שרת MCP:</span>
                                <code dir="ltr" className="text-xs font-mono text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 truncate select-all">
                                    {serverUrl}
                                </code>
                            </div>
                            <button
                                type="button"
                                onClick={() => copyToClipboard(serverUrl, 'serverUrl')}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-emerald-700 font-semibold text-xs transition-colors shrink-0 shadow-2xs"
                            >
                                {copiedField === 'serverUrl' ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>הועתק!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>העתק כתובת</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                                <span className="mr-3 text-slate-500 text-sm">טוען הגדרות ומפתחות...</span>
                            </div>
                        ) : (
                            <>
                                {/* TAB 1: API KEYS MANAGEMENT */}
                                {activeTab === 'keys' && (
                                    <div className="space-y-4">
                                        {/* Action Bar */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                מפתחות גישה פעילים ({keys.filter(k => !k.revoked).length})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateDialog(true)}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>צור מפתח חדש</span>
                                            </button>
                                        </div>

                                        {/* Keys List */}
                                        {keys.length === 0 ? (
                                            <div className="text-center py-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-3">
                                                <Key className="w-8 h-8 text-slate-400 mx-auto" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-700">עדיין לא נוצר אף מפתח גישה</p>
                                                    <p className="text-xs text-slate-500">לחץ על "צור מפתח חדש" כדי לחבר את Claude או Cursor לתיק שלך.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCreateDialog(true)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span>צור מפתח ל-Claude</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {keys.map((k) => (
                                                    <div 
                                                        key={k._id}
                                                        className={`p-3.5 rounded-2xl border transition-all ${
                                                            k.revoked 
                                                                ? 'bg-slate-50/50 border-slate-200/50 opacity-60' 
                                                                : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                            {/* Key Info */}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-slate-800">{k.name}</span>
                                                                    {k.revoked ? (
                                                                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                                                                            בוטל (Revoked)
                                                                        </span>
                                                                    ) : (
                                                                        k.scopes?.includes('write') ? (
                                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                                                קריאה וכתיבה (Read+Write)
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                                                קריאה בלבד (Read Only)
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                    <span dir="ltr" className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                                                                        {k.keyPrefix}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span>נוצר: {formatDate(k.createdAt)}</span>
                                                                    <span>•</span>
                                                                    <span>שימוש אחרון: {formatDate(k.lastUsedAt)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            {!k.revoked && (
                                                                <div className="flex items-center gap-2 self-end sm:self-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRevokeKey(k)}
                                                                        disabled={actionLoading}
                                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs flex items-center gap-1"
                                                                        title="בטל מפתח"
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-rose-500" />
                                                                        <span className="text-rose-600 font-medium">ביטול</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Security Notice */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-600 space-y-1">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>אבטחת מפתחות ברמה הגבוהה ביותר:</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed">
                                                המפתחות מוצפנים ב-DB באמצעות גיבוב חד-כיווני <span dir="ltr" className="font-mono font-semibold">SHA-256</span>. המפתח המלא אינו נשמר באתר ואינו מועבר לעולם בלוגים.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: CONNECT TO CLAUDE (Step by Step) */}
                                {activeTab === 'claude' && (
                                    <div className="space-y-4">
                                        <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-2xl text-xs text-blue-900 leading-relaxed">
                                            <div className="font-bold mb-1 flex items-center gap-1.5">
                                                <Bot className="w-4 h-4 text-blue-600" />
                                                <span>חיבור ישיר לממשק האינטרנט של Claude (claude.ai):</span>
                                            </div>
                                            <span>חבר את תיק ההשקעות שלך למודל של Anthropic כדי לשאול שאלות, לנתח רווח/הפסד ולבקש המלצות בזמן אמת.</span>
                                        </div>

                                        {/* Step by Step Guide */}
                                        <div className="space-y-3">
                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                                                    <span className="font-bold text-xs text-slate-800">פתח את ההגדרות ב-Claude:</span>
                                                </div>
                                                <p className="text-xs text-slate-600 mr-8 leading-relaxed">
                                                    היכנס אל <span dir="ltr" className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Settings → Connectors</span> ולחץ על <span dir="ltr" className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Add custom connector</span>.
                                                </p>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                                                    <span className="font-bold text-xs text-slate-800">הגדרת שם וכתובת:</span>
                                                </div>
                                                <div className="mr-8 space-y-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-500">שם מחבר (<span dir="ltr">Name</span>):</span>
                                                        <code dir="ltr" className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded mr-1">FinTechPro</code>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">כתובת שרת (<span dir="ltr">URL</span>):</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <code dir="ltr" className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 select-all truncate text-[11px]">
                                                                {serverUrl}
                                                            </code>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(serverUrl, 'claudeUrl')}
                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold text-[11px] shrink-0"
                                                            >
                                                                {copiedField === 'claudeUrl' ? 'הועתק!' : 'העתק'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                                                    <span className="font-bold text-xs text-slate-800">הגדרת אימות (Authorization Header):</span>
                                                </div>
                                                <div className="mr-8 space-y-2 text-xs text-slate-600 leading-relaxed">
                                                    <p>
                                                        תחת <span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">Authentication</span> בחר באפשרות <span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">No sign-in</span>.
                                                    </p>
                                                    <p>
                                                        לחץ על <span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">+ Add header</span> והזן:
                                                    </p>
                                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]" dir="ltr">
                                                        <div><span className="text-slate-500">Header Name: </span><span className="text-slate-800 font-bold">Authorization</span></div>
                                                        <div><span className="text-slate-500">Header Value: </span><span className="text-emerald-700 font-bold">Bearer ft_live_... (המפתח שיצרת)</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">4</span>
                                                    <span className="font-bold text-xs text-slate-800">סיום ובדיקה:</span>
                                                </div>
                                                <p className="text-xs text-slate-600 mr-8 leading-relaxed">
                                                    לחץ על <span dir="ltr" className="font-bold bg-slate-100 px-1.5 py-0.5 rounded">Add</span>. עכשיו פתח שיחה חדשה עם Claude, שאל: <span className="font-bold text-slate-800">"מה שווי תיק ההשקעות שלי ב-FinTechPro?"</span> ו-Claude ימשוך את הנתונים בזמן אמת!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: CLAUDE DESKTOP & CURSOR */}
                                {activeTab === 'desktop' && (
                                    <div className="space-y-4">
                                        {/* Claude Desktop Config */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                                <span>הגדרות עבור <code dir="ltr" className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">claude_desktop_config.json</code>:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(claudeDesktopSnippet, 'desktopJson')}
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                                                >
                                                    {copiedField === 'desktopJson' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>העתק JSON</span>
                                                </button>
                                            </div>
                                            <div dir="ltr" className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800">
                                                <pre className="p-3.5 text-emerald-400 font-mono text-[11px] sm:text-xs overflow-x-auto leading-relaxed text-left max-h-48 custom-scrollbar">
                                                    {claudeDesktopSnippet}
                                                </pre>
                                            </div>
                                        </div>

                                        {/* Cursor IDE instructions */}
                                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                                            <p className="font-bold text-slate-800">הוראות חיבור ב-Cursor / VS Code:</p>
                                            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                                                <li>פתח ב-Cursor את <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Settings → Features → MCP</span>.</li>
                                                <li>לחץ על <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">+ Add New MCP Server</span>.</li>
                                                <li>בחר סוג (<span dir="ltr">Type</span>): <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">sse</span>.</li>
                                                <li>שם: <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">fintechpro</span>.</li>
                                                <li>כתובת ה-SSE: <code dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 select-all">{serverUrl}/sse</code></li>
                                                <li>הוסף כותרת: <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Authorization: Bearer &lt;YOUR_API_KEY&gt;</span>.</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: AUDIT LOG & UNDO */}
                                {activeTab === 'audit' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                יומן פעולות AI והיסטוריית שינויים:
                                            </span>
                                            <button
                                                type="button"
                                                onClick={loadData}
                                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>רענן</span>
                                            </button>
                                        </div>

                                        {auditLogs.length === 0 ? (
                                            <div className="text-center py-10 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                                <History className="w-7 h-7 text-slate-400 mx-auto" />
                                                <p className="text-xs font-semibold text-slate-600">טרם נרשמו פעולות שבוצעו ע"י סוכן AI</p>
                                                <p className="text-[11px] text-slate-400">כאשר סוכן עם הרשאת כתיבה יבצע שינוי בתיק, הפעולה תופיע כאן וניתן יהיה לבטלה בקליק.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                                                {auditLogs.map((log) => (
                                                    <div 
                                                        key={log._id}
                                                        className={`p-3 rounded-2xl border transition-all text-xs ${
                                                            log.undone 
                                                                ? 'bg-slate-50/60 border-slate-200 opacity-60' 
                                                                : 'bg-white border-slate-200 shadow-2xs'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-slate-800">{log.symbol || 'תיק'}</span>
                                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono" dir="ltr">
                                                                        {log.action}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">({log.keyName})</span>
                                                                    {log.undone && (
                                                                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                                                            בוטל (Undone)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-slate-600 text-[11px] leading-relaxed">{log.details}</p>
                                                                <p className="text-[10px] text-slate-400">{formatDate(log.createdAt)}</p>
                                                            </div>

                                                            {!log.undone && log.canUndo && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUndoAudit(log)}
                                                                    disabled={undoingId === log._id}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-[11px] transition-colors border border-rose-200 shrink-0"
                                                                >
                                                                    {undoingId === log._id ? (
                                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <Undo2 className="w-3 h-3" />
                                                                    )}
                                                                    <span>בטל שינוי</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 5: TOOLS REFERENCE */}
                                {activeTab === 'tools' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-600">
                                            <span className="font-bold text-slate-800">13 כלים זמינים לסוכן ה-AI:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                                                    קריאה (Read)
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                                    כתיבה (Write)
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-72 overflow-y-auto custom-scrollbar">
                                            {/* Read Tools */}
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_portfolio_summary</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">שווי כולל, מזומן, שווי נקי, פילוח לפי ברוקרים (Blink, IBI) ורווח/הפסד.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_positions</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">כל המניות בתיק, מחירי שוק חיים, קרנות ישראליות (TASE), וברוקר.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_position_details</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">פירוט עמוק על מניה או קרן ישראלית והיסטוריית רכישות (Lots).</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_cash_balances</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">יתרות מזומן וקרנות כספיות לפי ברוקר ולפי מטבע (USD, ILS, EUR).</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_transactions</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">היסטוריית עסקאות קנייה, מכירה ופעולות שבוצעו בתיק.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_portfolio_news</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">חדשות כלכליות ממוקדות למניות שמוחזקות בתיק שלך.</p>
                                            </div>

                                            {/* Write Tools */}
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">add_position</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">כתיבה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">הוספת מניה או קרן ישראלית (ת"א 125), מחשב ממוצע אוטומטית.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-rose-600">sell_position</span>
                                                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold">פעולה הרסנית</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">מכירת כמות מניות או סגירת פוזיציה מלאה בתיק.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-rose-600">remove_position</span>
                                                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold">מחיקה רכה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">מחיקת פוזיציה ממעקב (שומר גיבוי לשחזור מידי).</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">update_cash_balance</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">כתיבה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">עדכון יתרת מזומן או קרן כספית לפי ברוקר ומטבע.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">import_positions</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">כתיבה מרוכזת</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">ייבוא מרוכז של רשימת מניות בפקודה אחת מהסוכן.</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_watchlist</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">קריאה</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">רשימת המעקב האישית והציטוטים החיים שלה.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Sub-Modal: Create New Key Dialog */}
            {showCreateDialog && mounted && createPortal(
                <div 
                    className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setShowCreateDialog(false)}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        dir="rtl"
                        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn text-slate-800"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Key className="w-5 h-5 text-emerald-600" />
                                <span>יצירת מפתח גישה חדש</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateKey} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    שם המפתח (זיהוי):
                                </label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder='למשל: "Claude", "Cursor", "Mobile"'
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    הרשאות גישה (<span dir="ltr">Scope</span>):
                                </label>
                                <div className="space-y-2 text-xs">
                                    <label className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/60">
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="read"
                                            checked={createScope === 'read'}
                                            onChange={() => setCreateScope('read')}
                                            className="mt-0.5 text-emerald-600"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-800">קריאה בלבד (מומלץ ובטוח)</span>
                                            <p className="text-[11px] text-slate-500">הסוכן יכול לצפות בשווי התיק, מניות, מזומן וחדשות, ללא אפשרות לשנות נתונים.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/60">
                                        <input
                                            type="radio"
                                            name="scope"
                                            value="write"
                                            checked={createScope === 'write'}
                                            onChange={() => setCreateScope('write')}
                                            className="mt-0.5 text-emerald-600"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-800">קריאה וכתיבה (Read & Write)</span>
                                            <p className="text-[11px] text-slate-500">מאפשר לסוכן להוסיף, לעדכן ולמחוק מניות לפי הודעותיך בצ'אט (מגובה ביומן שינויים ושחזור).</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    תוקף המפתח:
                                </label>
                                <select
                                    value={createExpires}
                                    onChange={(e) => setCreateExpires(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="never">ללא תפוגה (קבוע)</option>
                                    <option value="30">30 יום</option>
                                    <option value="90">90 יום</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateDialog(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                                >
                                    ביטול
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                                >
                                    {actionLoading ? 'יוצר...' : 'צור מפתח'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Sub-Modal: One-time Secret Key Reveal */}
            {newKeyData && mounted && createPortal(
                <div 
                    className="fixed inset-0 z-[10002] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setNewKeyData(null)}
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        dir="rtl"
                        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn text-slate-800"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">המפתח נוצר בהצלחה! שמור אותו עכשיו</h3>
                                <p className="text-xs text-slate-500">מטעמי אבטחה, המפתח המלא מוצג פעם אחת בלבד ולא ניתן לצפות בו שוב.</p>
                            </div>
                        </div>

                        {/* Secret Raw Key Box */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700">ערך המפתח (<span dir="ltr">API Key</span>):</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    dir="ltr"
                                    readOnly
                                    value={newKeyData.rawKey}
                                    className="w-full p-2.5 text-xs font-mono bg-slate-50 rounded-xl border border-slate-200 select-all font-semibold text-slate-800"
                                />
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(newKeyData.rawKey, 'newKeyRaw')}
                                    className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors"
                                >
                                    {copiedField === 'newKeyRaw' ? 'הועתק!' : 'העתק מפתח'}
                                </button>
                            </div>
                        </div>

                        {/* Bearer Header Ready Value */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700">ערך מלא להדבקה ב-Claude (<span dir="ltr">Header Value</span>):</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    dir="ltr"
                                    readOnly
                                    value={`Bearer ${newKeyData.rawKey}`}
                                    className="w-full p-2.5 text-xs font-mono bg-slate-50 rounded-xl border border-slate-200 select-all font-semibold text-emerald-800"
                                />
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(`Bearer ${newKeyData.rawKey}`, 'newKeyBearer')}
                                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors"
                                >
                                    {copiedField === 'newKeyBearer' ? 'הועתק!' : 'העתק Bearer'}
                                </button>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                העתק כעת את המפתח והדבק אותו ב-Claude או Cursor. לאחר סגירת חלון זה, תוכל לראות רק את תחילית המפתח ({newKeyData.keyPrefix}).
                            </span>
                        </div>

                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={() => setNewKeyData(null)}
                                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                            >
                                הבנתי, שמרתי את המפתח
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
