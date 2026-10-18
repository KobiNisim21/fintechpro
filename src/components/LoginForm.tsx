import { useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function GoogleLoginInner() {
    const { loginWithGoogle } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSuccess = async (credentialResponse: any) => {
        if (!credentialResponse.credential) {
            setError('לא התקבל אימות מגוגל');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await loginWithGoogle(credentialResponse.credential);
        } catch (err: any) {
            setError(err.message || 'ההתחברות נכשלה');
        } finally {
            setLoading(false);
        }
    };

    const handleError = () => {
        setError(
            'חלון ההתחברות של גוגל נחסם על ידי הדפדפן. אנא בדוק אם יש חוסם חלונות קופצים (Pop-up Blocker) או תוסף חוסם פרסומות (AdBlock) הפעיל בדפדפן.'
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-ios-bg-gradient)' }}>
            <div className="w-full max-w-md p-8 space-y-8 glass-card rounded-[32px]">
                {/* Logo & Title */}
                <div className="text-center space-y-3">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">FinTechPro</h1>
                    <p className="text-slate-500 text-sm">Real-time portfolio management & market insights</p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm text-center leading-relaxed">
                        <div className="font-semibold mb-1">שים לב:</div>
                        {error}
                        <div className="mt-2 text-xs text-rose-500">
                            (בדוק בשורת הכתובות של הדפדפן למעלה אם מופיע אייקון חסימת חלון קופץ 🚫)
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-3 text-slate-500 text-sm">Signing you in...</span>
                    </div>
                )}

                {/* Google Sign In Button */}
                {!loading && (
                    <div className="flex flex-col items-center gap-3">
                        <GoogleLogin
                            onSuccess={handleSuccess}
                            onError={handleError}
                            theme="outline"
                            size="large"
                            shape="pill"
                            text="continue_with"
                            width="320"
                            use_fedcm_for_button={true}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="text-center">
                    <p className="text-xs text-slate-400">
                        By signing in, you agree to our Terms of Service.
                        <br />Your portfolio data is stored securely.
                    </p>
                </div>
            </div>
        </div>
    );
}

export function LoginForm() {
    if (!GOOGLE_CLIENT_ID) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
                <div className="w-full max-w-md p-8 glass-card rounded-[32px] text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">Configuration Error</h1>
                    <p className="text-rose-500 text-sm">VITE_GOOGLE_CLIENT_ID is not set. Please configure it in your environment variables.</p>
                </div>
            </div>
        );
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleLoginInner />
        </GoogleOAuthProvider>
    );
}
