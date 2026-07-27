import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mail, CheckCircle } from 'lucide-react';

export function RegisterForm() {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await register({ name, email, password });
            // If server returns requiresVerification, show the success screen
            if ((result as any)?.requiresVerification) {
                setVerificationSent(true);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Success state: verification email sent
    if (verificationSent) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
                <div className="w-full max-w-md p-8 space-y-6 glass-card rounded-[32px] text-center">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                            <Mail className="w-10 h-10 text-emerald-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Check your email</h1>
                        <p className="text-slate-500 mt-2 leading-relaxed">
                            We sent a verification link to <span className="font-semibold text-slate-700">{email}</span>.
                            Please click the link to activate your account.
                        </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-700">
                        <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        The link expires in <strong>24 hours</strong>
                    </div>
                    <p className="text-sm text-slate-500">
                        Already verified?{' '}
                        <a href="/login" className="text-emerald-500 hover:text-emerald-600 font-medium">
                            Sign in
                        </a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-ios-bg-gradient)' }}>
            <div className="w-full max-w-md p-8 space-y-6 glass-card rounded-[32px]">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800">Create Account</h1>
                    <p className="text-slate-500 mt-2">Join FinTechPro today</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <Label htmlFor="name" className="text-slate-600">Full Name</Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-slate-300"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="email" className="text-slate-600">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-slate-300"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="password" className="text-slate-600">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-slate-300"
                            minLength={6}
                            required
                        />
                        <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-11 font-semibold"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                </form>

                <div className="text-center text-sm text-slate-500">
                    Already have an account?{' '}
                    <a href="/login" className="text-emerald-500 hover:text-emerald-600 font-medium">
                        Sign in
                    </a>
                </div>
            </div>
        </div>
    );
}

