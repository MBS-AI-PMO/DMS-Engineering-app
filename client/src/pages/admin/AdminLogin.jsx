import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useToast } from '../../context/ToastContext';

// Helper to set cookie
const setCookie = (name, value, days = 30) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

// Helper to get cookie
const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
};

export default function AdminLogin() {
    const { login } = useAdminAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    // Load remembered email on mount
    useEffect(() => {
        const savedEmail = getCookie('admin_remember_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (rememberMe) {
            setCookie('admin_remember_email', email);
        } else {
            setCookie('admin_remember_email', '', -1); // Delete
        }

        try {
            await login(email, password);
            toast('Welcome back! Login successful.', 'success');
            navigate('/admin');
        } catch (err) {
            const msg = err.message || 'Invalid credentials';
            setError(msg);
            toast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-page">
            <motion.div
                className="admin-login-card"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="admin-login-header">
                    <h1>DMS Admin</h1>
                    <p>Sign in to your account</p>
                </div>

                <form className="admin-login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="admin-login-error">{error}</div>
                    )}
                    <div className="admin-form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoFocus
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div className="admin-form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="admin-login-remember" style={{ marginBottom: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={e => setRememberMe(e.target.checked)}
                                style={{ accentColor: '#e31b23' }}
                            />
                            Remember email
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="admin-login-btn"
                        disabled={loading}
                    >
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
