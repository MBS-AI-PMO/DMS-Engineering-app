import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { User, Mail, Lock, Eye, EyeOff, UserPlus, CheckSquare } from 'lucide-react';
import { registerUser } from '../utils/api';

export default function Signup() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', terms: false });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (field) => (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => ({ ...f, [field]: val }));
    };

    const validate = () => {
        if (!form.name.trim()) return 'Full name is required';
        if (!form.email) return 'Email address is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address';
        if (form.password.length < 8) return 'Password must be at least 8 characters';
        if (form.password !== form.confirmPassword) return 'Passwords do not match';
        if (!form.terms) return 'You must accept the Terms and Conditions';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) { setError(validationError); return; }

        setError('');
        setLoading(true);
        try {
            await registerUser({ name: form.name, email: form.email, password: form.password, terms: form.terms });
            navigate('/login?registered=1');
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = () => {
        const p = form.password;
        if (!p) return null;
        if (p.length < 8) return { level: 1, label: 'Weak', color: '#ef4444' };
        if (p.length < 12 || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { level: 2, label: 'Fair', color: '#f59e0b' };
        return { level: 3, label: 'Strong', color: '#22c55e' };
    };

    const strength = passwordStrength();

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />
            <motion.div
                className="auth-card auth-card-wide"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="auth-logo">
                    <Link to="/">
                        <img src="/logo.png" alt="DMS Logo" className="auth-logo-img" decoding="async" />
                    </Link>
                </div>

                <div className="auth-header">
                    <h1>Create Account</h1>
                    <p>Join DMS Engineering to manage your orders and pricing</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
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
                        <label htmlFor="name">Full Name</label>
                        <div className="auth-input-wrapper">
                            <User size={18} className="auth-input-icon" />
                            <input
                                id="name"
                                type="text"
                                value={form.name}
                                onChange={set('name')}
                                placeholder="John Smith"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="email">Email Address</label>
                        <div className="auth-input-wrapper">
                            <Mail size={18} className="auth-input-icon" />
                            <input
                                id="email"
                                type="email"
                                value={form.email}
                                onChange={set('email')}
                                placeholder="you@example.com"
                                required
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
                                value={form.password}
                                onChange={set('password')}
                                placeholder="Min. 8 characters"
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
                        {strength && (
                            <div className="auth-password-strength">
                                <div className="strength-bars">
                                    {[1, 2, 3].map(n => (
                                        <div
                                            key={n}
                                            className="strength-bar"
                                            style={{ background: n <= strength.level ? strength.color : 'rgba(255,255,255,0.1)' }}
                                        />
                                    ))}
                                </div>
                                <span style={{ color: strength.color }}>{strength.label}</span>
                            </div>
                        )}
                    </div>

                    <div className="auth-field">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="auth-input-wrapper">
                            <Lock size={18} className="auth-input-icon" />
                            <input
                                id="confirmPassword"
                                type={showConfirm ? 'text' : 'password'}
                                value={form.confirmPassword}
                                onChange={set('confirmPassword')}
                                placeholder="Repeat your password"
                                required
                            />
                            <button
                                type="button"
                                className="auth-eye-btn"
                                onClick={() => setShowConfirm(v => !v)}
                                tabIndex={-1}
                            >
                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <label className="auth-checkbox-label">
                        <input
                            type="checkbox"
                            checked={form.terms}
                            onChange={set('terms')}
                            required
                        />
                        <CheckSquare size={18} className="auth-checkbox-icon" />
                        <span>
                            I agree to the{' '}
                            <Link to="/contact" onClick={e => e.stopPropagation()}>Terms and Conditions</Link>
                        </span>
                    </label>

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? (
                            <span className="auth-btn-spinner" />
                        ) : (
                            <>
                                <UserPlus size={18} />
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <Link to="/login">Sign in</Link>
                </div>
            </motion.div>
        </div>
    );
}
