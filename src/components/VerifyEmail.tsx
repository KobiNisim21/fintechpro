import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Verification token is missing.');
            return;
        }

        const verify = async () => {
            try {
                // The auth API doesn't have a verify method yet, let's use fetch directly for simplicity
                const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
                const response = await fetch(`${apiUrl}/auth/verify-email?token=${token}`);
                const data = await response.json();

                if (response.ok) {
                    setStatus('success');
                    setMessage(data.message || 'Email verified successfully!');
                    // Optionally we could log them in here if the backend sent a token
                    // But usually they just click a button to go to login
                } else {
                    setStatus('error');
                    setMessage(data.message || 'Failed to verify email.');
                }
            } catch (err: any) {
                setStatus('error');
                setMessage('An error occurred during verification.');
            }
        };

        verify();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
            <div className="w-full max-w-md p-8 space-y-6 glass-card rounded-[32px] text-center">
                
                {status === 'verifying' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-slate-500 animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Verifying Email...</h1>
                        <p className="text-slate-500">Please wait while we verify your account.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Account Verified!</h1>
                        <p className="text-slate-500">{message}</p>
                        <Button 
                            onClick={() => navigate('/login')}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 font-semibold mt-4"
                        >
                            Continue to Login
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-rose-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Verification Failed</h1>
                        <p className="text-rose-500">{message}</p>
                        <div className="space-y-3 w-full mt-4">
                            <Button 
                                onClick={() => navigate('/register')}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl h-11 font-semibold"
                            >
                                Try Registering Again
                            </Button>
                            <Button 
                                variant="outline"
                                onClick={() => navigate('/login')}
                                className="w-full border-slate-200 text-slate-600 rounded-xl h-11 font-semibold"
                            >
                                Back to Login
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
