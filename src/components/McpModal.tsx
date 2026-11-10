import { t, useLanguage, locale, errorText } from '@/i18n';
import { useState, useEffect } from 'react';
import { SimpleDialog } from './SimpleDialog';
import {
    Bot, Copy, Check, RefreshCw, Trash2, Key,
    Undo2, AlertTriangle, Plus,
    ShieldAlert, Lock, Layers, History, Wrench
} from 'lucide-react';
import { mcpAPI, ApiKeyItem, CreateKeyResponse, AuditLogItem } from '../api/mcp';

export function McpModal() {
    useLanguage();
    const [open, setOpen] = useState(false);
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

    // Copying state
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Undo action loading
    const [undoingId, setUndoingId] = useState<string | null>(null);

    useEffect(() => { if (open) void loadData(); }, [open]);

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
            const keyItem: ApiKeyItem = {
                _id: created._id,
                name: created.name,
                keyPrefix: created.keyPrefix,
                scopes: created.scopes,
                expiresAt: created.expiresAt,
                createdAt: created.createdAt,
                lastUsedAt: null,
                revoked: false,
            };
            setKeys(prev => [keyItem, ...prev]);
            setNewKeyData(created);
            setShowCreateDialog(false);
            setCreateName('Claude');
            setCreateScope('read');
            setCreateExpires('never');
        } catch (err: any) {
            alert(t('שגיאה ביצירת מפתח: ') + errorText(err.message || 'שגיאת שרת'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeKey = async (keyItem: ApiKeyItem) => {
        if (!confirm(t("האם אתה בטוח שברצונך לבטל את המפתח \"{0}\" ({1})? סוכן AI המשתמש בו יאבד גישה מידית.", [keyItem.name, keyItem.keyPrefix]))) {
            return;
        }

        setActionLoading(true);
        try {
            await mcpAPI.revokeKey(keyItem._id);
            setKeys(prev => prev.map(k => k._id === keyItem._id ? { ...k, revoked: true } : k));
        } catch (err: any) {
            alert(t('שגיאה בביטול מפתח: ') + errorText(err.message || 'שגיאת שרת'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleUndoAudit = async (logItem: AuditLogItem) => {
        if (!confirm(t("האם לשחזר את הפעולה: \"{0}\"?", [logItem.details]))) {
            return;
        }

        setUndoingId(logItem._id);
        try {
            const res = await mcpAPI.undoAudit(logItem._id);
            alert(t(res.message || 'הפעולה שוחזרה בהצלחה!'));
            // Update local state
            setAuditLogs(prev => prev.map(l => l._id === logItem._id ? { ...l, undone: true } : l));
        } catch (err: any) {
            alert(t('שגיאה בשחזור פעולה: ') + errorText(err.response?.data?.message || err.message || 'שגיאת שרת'));
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
        if (!isoString) return t('טרם שומש');
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString(locale(), {
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
                className="mcp-connect-button flex items-center justify-between gap-3 w-full p-3 rounded-xl bg-accent-soft border border-line text-ink font-semibold transition-colors duration-base group"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-accent shrink-0">
                        <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold tracking-wide truncate">{t("חיבור ל-Claude / AI")}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 shrink-0">
                    {t("MCP Live")}
                </span>
            </button>

            {/* Modal Portal */}
            {open && <SimpleDialog open={!!open} onClose={() => setOpen(false)} title={t("Connect AI to portfolio")} wide>{/* Navigation Tabs */}
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
                                <span>{t("מפתחות גישה")}</span>
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
                                <span>{t("חיבור ל-Claude")}</span>
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
                                <span>{t("Cursor / Desktop")}</span>
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
                                <span>{t("פעולות AI & שחזור")}</span>
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
                                <span>{t("כלים זמינים")}</span>
                            </button>
                        </div>

                        {/* Server URL Bar (Visible on all tabs) */}
                        <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-slate-700 shrink-0">{t("כתובת שרת MCP:")}</span>
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
                                        <span>{t("הועתק!")}</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>{t("העתק כתובת")}</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                                <span className="me-3 text-slate-500 text-sm">{t("טוען הגדרות ומפתחות...")}</span>
                            </div>
                        ) : (
                            <>
                                {/* TAB 1: API KEYS MANAGEMENT */}
                                {activeTab === 'keys' && (
                                    <div className="space-y-4">
                                        {/* Action Bar */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                {t("מפתחות גישה פעילים (")}{keys.filter(k => !k.revoked).length})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateDialog(true)}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>{t("צור מפתח חדש")}</span>
                                            </button>
                                        </div>

                                        {/* Keys List */}
                                        {keys.length === 0 ? (
                                            <div className="text-center py-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-3">
                                                <Key className="w-8 h-8 text-slate-400 mx-auto" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-700">{t("עדיין לא נוצר אף מפתח גישה")}</p>
                                                    <p className="text-xs text-slate-500">{t("לחץ על \"צור מפתח חדש\" כדי לחבר את Claude או Cursor לתיק שלך.")}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCreateDialog(true)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span>{t("צור מפתח ל-Claude")}</span>
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
                                                                            {t("בוטל (Revoked)")}</span>
                                                                    ) : (
                                                                        k.scopes?.includes('write') ? (
                                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                                                                {t("קריאה וכתיבה (Read+Write)")}</span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                                                {t("קריאה בלבד (Read Only)")}</span>
                                                                        )
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                    <span dir="ltr" className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                                                                        {k.keyPrefix}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span>{t("נוצר: ")}{formatDate(k.createdAt)}</span>
                                                                    <span>•</span>
                                                                    <span>{t("שימוש אחרון: ")}{formatDate(k.lastUsedAt)}</span>
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
                                                                        title={t("בטל מפתח")}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-rose-500" />
                                                                        <span className="text-rose-600 font-medium">{t("ביטול")}</span>
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
                                                <span>{t("אבטחת מפתחות ברמה הגבוהה ביותר:")}</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed">
                                                {t("המפתחות מוצפנים ב-DB באמצעות גיבוב חד-כיווני ")}<span dir="ltr" className="font-mono font-semibold">SHA-256</span>{t(". המפתח המלא אינו נשמר באתר ואינו מועבר לעולם בלוגים.")}
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
                                                <span>{t("חיבור ישיר לממשק האינטרנט של Claude (claude.ai):")}</span>
                                            </div>
                                            <span>{t("חבר את תיק ההשקעות שלך למודל של Anthropic כדי לשאול שאלות, לנתח רווח/הפסד ולבקש המלצות בזמן אמת.")}</span>
                                        </div>

                                        {/* Step by Step Guide */}
                                        <div className="space-y-3">
                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                                                    <span className="font-bold text-xs text-slate-800">{t("פתח את ההגדרות ב-Claude:")}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 me-8 leading-relaxed">
                                                    {t("היכנס אל ")}<span dir="ltr" className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Settings → Connectors</span> {t(" ולחץ על ")}<span dir="ltr" className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Add custom connector</span>.
                                                </p>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                                                    <span className="font-bold text-xs text-slate-800">{t("הגדרת שם וכתובת:")}</span>
                                                </div>
                                                <div className="me-8 space-y-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-500">{t("שם מחבר (")}<span dir="ltr">{t("Name")}</span>):</span>
                                                        <code dir="ltr" className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded me-1">FinTechPro</code>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">{t("כתובת שרת (")}<span dir="ltr">URL</span>):</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <code dir="ltr" className="font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 select-all truncate text-[11px]">
                                                                {serverUrl}
                                                            </code>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(serverUrl, 'claudeUrl')}
                                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold text-[11px] shrink-0"
                                                            >
                                                                {copiedField === 'claudeUrl' ? t("הועתק!") : t("העתק")}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                                                    <span className="font-bold text-xs text-slate-800">{t("הגדרת אימות (Authorization Header):")}</span>
                                                </div>
                                                <div className="me-8 space-y-2 text-xs text-slate-600 leading-relaxed">
                                                    <p>
                                                        {t("תחת ")}<span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">Authentication</span> {t(" בחר באפשרות ")}<span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">No sign-in</span>.
                                                    </p>
                                                    <p>
                                                        {t("לחץ על ")}<span dir="ltr" className="font-semibold bg-slate-100 px-1 py-0.5 rounded">+ Add header</span> {t(" והזן:")}</p>
                                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]" dir="ltr">
                                                        <div><span className="text-slate-500">Header Name: </span><span className="text-slate-800 font-bold">Authorization</span></div>
                                                        <div><span className="text-slate-500">Header Value: </span><span className="text-emerald-700 font-bold">{t("Bearer ft_live_... (המפתח שיצרת)")}</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">4</span>
                                                    <span className="font-bold text-xs text-slate-800">{t("סיום ובדיקה:")}</span>
                                                </div>
                                                <p className="text-xs text-slate-600 me-8 leading-relaxed">
                                                    {t("לחץ על ")}<span dir="ltr" className="font-bold bg-slate-100 px-1.5 py-0.5 rounded">Add</span>{t(". עכשיו פתח שיחה חדשה עם Claude, שאל:")} <span className="font-bold text-slate-800">{t("\"מה שווי תיק ההשקעות שלי ב-FinTechPro?\"")}</span> {t(" ו-Claude ימשוך את הנתונים בזמן אמת!")}</p>
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
                                                <span>{t("הגדרות עבור ")}<code dir="ltr" className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">claude_desktop_config.json</code>:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(claudeDesktopSnippet, 'desktopJson')}
                                                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold text-[11px]"
                                                >
                                                    {copiedField === 'desktopJson' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                    <span>{t("העתק JSON")}</span>
                                                </button>
                                            </div>
                                            <div dir="ltr" className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800">
                                                <pre className="p-3.5 text-emerald-400 font-mono text-[11px] sm:text-xs overflow-x-auto leading-relaxed text-start max-h-48 custom-scrollbar">
                                                    {claudeDesktopSnippet}
                                                </pre>
                                            </div>
                                        </div>

                                        {/* Cursor IDE instructions */}
                                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                                            <p className="font-bold text-slate-800">{t("הוראות חיבור ב-Cursor / VS Code:")}</p>
                                            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                                                <li>{t("פתח ב-Cursor את ")}<span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Settings → Features → MCP</span>.</li>
                                                <li>{t("לחץ על ")}<span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">+ Add New MCP Server</span>.</li>
                                                <li>{t("בחר סוג (")}<span dir="ltr">{t("Type")}</span>): <span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">sse</span>.</li>
                                                <li>{t("שם: ")}<span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">fintechpro</span>.</li>
                                                <li>{t("כתובת ה-SSE: ")}<code dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 select-all">{serverUrl}/sse</code></li>
                                                <li>{t("הוסף כותרת: ")}<span dir="ltr" className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Authorization: Bearer &lt;YOUR_API_KEY&gt;</span>.</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: AUDIT LOG & UNDO */}
                                {activeTab === 'audit' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">
                                                {t("יומן פעולות AI והיסטוריית שינויים:")}</span>
                                            <button
                                                type="button"
                                                onClick={loadData}
                                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                <span>{t("רענן")}</span>
                                            </button>
                                        </div>

                                        {auditLogs.length === 0 ? (
                                            <div className="text-center py-10 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                                <History className="w-7 h-7 text-slate-400 mx-auto" />
                                                <p className="text-xs font-semibold text-slate-600">{t("טרם נרשמו פעולות שבוצעו ע\"י סוכן AI")}</p>
                                                <p className="text-[11px] text-slate-400">{t("כאשר סוכן עם הרשאת כתיבה יבצע שינוי בתיק, הפעולה תופיע כאן וניתן יהיה לבטלה בקליק.")}</p>
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
                                                                    <span className="font-bold text-slate-800">{log.symbol || t("תיק")}</span>
                                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono" dir="ltr">
                                                                        {log.action}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">({log.keyName})</span>
                                                                    {log.undone && (
                                                                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                                                            {t("בוטל (Undone)")}</span>
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
                                                                    <span>{t("בטל שינוי")}</span>
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
                                            <span className="font-bold text-slate-800">{t("13 כלים זמינים לסוכן ה-AI:")}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                                                    {t("קריאה (Read)")}</span>
                                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                                    {t("כתיבה (Write)")}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-72 overflow-y-auto custom-scrollbar">
                                            {/* Read Tools */}
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_portfolio_summary</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("שווי כולל, מזומן, שווי נקי, פילוח לפי ברוקרים (Blink, IBI) ורווח/הפסד.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_positions</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("כל המניות בתיק, מחירי שוק חיים, קרנות ישראליות (TASE), וברוקר.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_position_details</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("פירוט עמוק על מניה או קרן ישראלית והיסטוריית רכישות (Lots).")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_cash_balances</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("יתרות מזומן וקרנות כספיות לפי ברוקר ולפי מטבע (USD, ILS, EUR).")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_transactions</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("היסטוריית עסקאות קנייה, מכירה ופעולות שבוצעו בתיק.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_portfolio_news</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("חדשות כלכליות ממוקדות למניות שמוחזקות בתיק שלך.")}</p>
                                            </div>

                                            {/* Write Tools */}
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">add_position</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">{t("כתיבה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("הוספת מניה או קרן ישראלית (ת\"א 125), מחשב ממוצע אוטומטית.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-rose-600">sell_position</span>
                                                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold">{t("פעולה הרסנית")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("מכירת כמות מניות או סגירת פוזיציה מלאה בתיק.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-rose-600">remove_position</span>
                                                    <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold">{t("מחיקה רכה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("מחיקת פוזיציה ממעקב (שומר גיבוי לשחזור מידי).")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">update_cash_balance</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">{t("כתיבה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("עדכון יתרת מזומן או קרן כספית לפי ברוקר ומטבע.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-emerald-600">import_positions</span>
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">{t("כתיבה מרוכזת")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("ייבוא מרוכז של רשימת מניות בפקודה אחת מהסוכן.")}</p>
                                            </div>

                                            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                                <div className="flex items-center justify-between">
                                                    <span dir="ltr" className="font-mono font-bold text-blue-600">get_watchlist</span>
                                                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold">{t("קריאה")}</span>
                                                </div>
                                                <p className="text-slate-500 text-[11px] mt-1">{t("רשימת המעקב האישית והציטוטים החיים שלה.")}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </SimpleDialog>}

            {/* Sub-Modal: Create New Key Dialog */}
            {showCreateDialog && <SimpleDialog open={!!showCreateDialog} onClose={() => setShowCreateDialog(false)} title={t("Create a new access key")}><form onSubmit={handleCreateKey} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {t("שם המפתח (זיהוי):")}</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder={t("למשל: \"Claude\", \"Cursor\", \"Mobile\"")}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {t("הרשאות גישה (")}<span dir="ltr">Scope</span>):
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
                                            <span className="font-bold text-slate-800">{t("קריאה בלבד (מומלץ ובטוח)")}</span>
                                            <p className="text-[11px] text-slate-500">{t("הסוכן יכול לצפות בשווי התיק, מניות, מזומן וחדשות, ללא אפשרות לשנות נתונים.")}</p>
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
                                            <span className="font-bold text-slate-800">{t("קריאה וכתיבה (Read & Write)")}</span>
                                            <p className="text-[11px] text-slate-500">{t("מאפשר לסוכן להוסיף, לעדכן ולמחוק מניות לפי הודעותיך בצ'אט (מגובה ביומן שינויים ושחזור).")}</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {t("תוקף המפתח:")}</label>
                                <select
                                    value={createExpires}
                                    onChange={(e) => setCreateExpires(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="never">{t("ללא תפוגה (קבוע)")}</option>
                                    <option value="30">{t("30 יום")}</option>
                                    <option value="90">{t("90 יום")}</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateDialog(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                                >
                                    {t("ביטול")}</button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                                >
                                    {actionLoading ? t("יוצר...") : t("צור מפתח")}
                                </button>
                            </div>
                        </form>
                    </SimpleDialog>}

            {/* Sub-Modal: One-time Secret Key Reveal */}
            {newKeyData && <SimpleDialog open={!!newKeyData} onClose={() => setNewKeyData(null)} title={t("Key created! Save it now")}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div>

                                <p className="text-xs text-slate-500">{t("מטעמי אבטחה, המפתח המלא מוצג פעם אחת בלבד ולא ניתן לצפות בו שוב.")}</p>
                            </div>
                        </div>

                        {/* Secret Raw Key Box */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700">{t("ערך המפתח (")}<span dir="ltr">API Key</span>):</span>
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
                                    {copiedField === 'newKeyRaw' ? t("הועתק!") : t("העתק מפתח")}
                                </button>
                            </div>
                        </div>

                        {/* Bearer Header Ready Value */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700">{t("ערך מלא להדבקה ב-Claude (")}<span dir="ltr">Header Value</span>):</span>
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
                                    {copiedField === 'newKeyBearer' ? t("הועתק!") : t("העתק Bearer")}
                                </button>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                {t("העתק כעת את המפתח והדבק אותו ב-Claude או Cursor. לאחר סגירת חלון זה, תוכל לראות רק את תחילית המפתח (")}{newKeyData.keyPrefix}).
                            </span>
                        </div>

                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={() => setNewKeyData(null)}
                                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                            >
                                {t("הבנתי, שמרתי את המפתח")}</button>
                        </div>
                    </SimpleDialog>}
        </>
    );
}
