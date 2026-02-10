import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function RegisterForm() {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await register({ name, email, password });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f0f12]">
            <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white">Create Account</h1>
                    <p className="text-zinc-400 mt-2">Join TraderAI today</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <Label htmlFor="name" className="text-white/70">Full Name</Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 bg-white/5 border-white/10 text-white"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="email" className="text-white/70">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 bg-white/5 border-white/10 text-white"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="password" className="text-white/70">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 bg-white/5 border-white/10 text-white"
                            minLength={6}
                            required
                        />
                        <p className="text-xs text-zinc-500 mt-1">Minimum 6 characters</p>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                </form>

                <div className="text-center text-sm text-zinc-400">
                    Already have an account?{' '}
                    <a href="/login" className="text-emerald-500 hover:text-emerald-400">
                        Sign in
                    </a>
                </div>
            </div>
        </div>
    );
}
