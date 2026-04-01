import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useToast } from '../../context/ToastContext';

export default function AdminLogin() {
    const { login } = useAdminAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
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
