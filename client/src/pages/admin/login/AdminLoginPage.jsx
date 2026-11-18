import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Checkbox, Field, Input } from '../../../components/admin/ui';
import { PasswordInput } from '../people/PasswordInput';
import usePageHero from '../../../hooks/usePageHero';
// Sign-in is outside AdminLayout (which loads the kit styles), so it loads them itself.
import '../../../styles/adminKit.css';
import './adminLogin.css';

// The "Remember my email" cookie (same name and format as before).
const REMEMBER_COOKIE = 'admin_remember_email';

const setCookie = (name, value, days = 30) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => document.cookie.split('; ').reduce((found, pair) => {
    const parts = pair.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : found;
}, '');

/**
 * Admin sign-in (/admin/login), dark split screen: the home page photo on
 * the left, the form on the right. Email + password through
 * AdminAuthContext, then on to the dashboard. "Remember my email" keeps the
 * address in a cookie for 30 days.
 */
export default function AdminLoginPage() {
    const { login } = useAdminAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [remembered] = useState(() => getCookie(REMEMBER_COOKIE));
    const [email, setEmail] = useState(remembered);
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(Boolean(remembered));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const hero = usePageHero('home');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (rememberMe) setCookie(REMEMBER_COOKIE, email);
        else setCookie(REMEMBER_COOKIE, '', -1);

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
        <div className="al-page">
            {/* Left: the home page photo with the company name (a short banner on phones). */}
            <aside className="al-visual" aria-hidden="true">
                {hero.src && <img className="al-visual-img" src={hero.src} srcSet={hero.srcSet} sizes="(max-width: 900px) 100vw, 55vw" alt="" decoding="async" />}
                <div className="al-visual-shade" />
                <div className="al-visual-text">
                    <span className="al-visual-kicker">Admin console</span>
                    <p className="al-visual-title">Dynamic Manufacturing Solutions</p>
                    <p className="al-visual-sub">Orders, quotes, pricing and the website, in one place.</p>
                </div>
            </aside>

            {/* Right: the form on a plain dark panel. */}
            <main className="al-panel" aria-labelledby="al-title">
                <a className="al-back" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to the website</a>
                <div className="al-form-wrap">
                    <h1 id="al-title" className="al-title">Welcome back</h1>
                    <p className="al-sub">Sign in with the email and password of your admin account.</p>

                    <form className="al-form" onSubmit={handleSubmit}>
                        {error && <Banner tone="error">{error}</Banner>}
                        <Field label="Email">
                            <Input
                                type="email"
                                name="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="username"
                                autoFocus={!remembered}
                                placeholder="you@example.com"
                                invalid={Boolean(error)}
                            />
                        </Field>
                        <Field label="Password">
                            <PasswordInput
                                name="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                autoFocus={Boolean(remembered)}
                                invalid={Boolean(error)}
                            />
                        </Field>
                        <Checkbox label="Remember my email" checked={rememberMe} onChange={setRememberMe} />
                        <Button type="submit" variant="primary" block icon={LogIn} loading={loading}>
                            {loading ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </form>
                    <p className="al-secure"><ShieldCheck size={15} aria-hidden="true" /> Admins only. Every sign-in is checked by the server.</p>
                </div>
            </main>
        </div>
    );
}
