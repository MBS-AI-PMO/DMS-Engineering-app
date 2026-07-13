import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Mail, Lock, Eye, EyeOff, LogIn, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchSettings } from '../utils/api';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const justRegistered = searchParams.get('registered') === '1';
    const redirectTo = searchParams.get('redirect');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [logo, setLogo] = useState(localStorage.getItem('navbar_logo') || '/logo.webp');

    useEffect(() => {
        fetchSettings()
            .then(data => {
                if (data.navbar_logo) {
                    setLogo(data.navbar_logo);
                    localStorage.setItem('navbar_logo', data.navbar_logo);
                }
            })
            .catch(err => console.error('Failed to load logo:', err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(email, password);
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate(redirectTo || '/');
            }
        } catch (err) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />
            <motion.div
                className="auth-card"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="auth-logo">
                    <Link to="/">
                        <img src={logo} alt="DMS Logo" className="auth-logo-img" decoding="async" />
                    </Link>
                </div>

                <div className="auth-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to your DMS Engineering account</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {justRegistered && (
                        <motion.div
                            className="auth-success"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <CheckCircle size={16} />
                            Account created! Sign in below.
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            className="auth-error"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}

                    <div className="auth-field">
                        <label htmlFor="email">Email Address</label>
                        <div className="auth-input-wrapper">
                            <Mail size={18} className="auth-input-icon" />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <div className="auth-input-wrapper">
                            <Lock size={18} className="auth-input-icon" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                className="auth-eye-btn"
                                onClick={() => setShowPassword(v => !v)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? (
                            <span className="auth-btn-spinner" />
                        ) : (
                            <>
                                <LogIn size={18} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <Link to={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}>Create one</Link>
                </div>
            </motion.div>
        </div>
    );
}
