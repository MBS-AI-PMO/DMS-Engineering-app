import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateUserProfile, updateUserPassword } from '../utils/api';
import { useToast } from '../context/ToastContext';
import '../styles/Shimmer.css';
import '../styles/AccountPages.css';

/**
 * Account settings: a short dark heading band with the person's initial,
 * name and email, then two white panels — profile details and password.
 * Saving works as before (toasts on success or failure); fields shimmer
 * until the profile has loaded.
 */

const PasswordField = ({ label, value, onChange, autoComplete, placeholder, shown, onToggle }) => (
    <label className="acc-field">
        <span className="acc-label">{label}</span>
        <span className="acc-input-wrap">
            <input
                type={shown ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
                placeholder={placeholder}
                required
            />
            {onToggle && (
                <button type="button" className="acc-eye" onClick={onToggle} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
                    {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
            )}
        </span>
    </label>
);

export default function Settings() {
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({ name: '', email: '', phone: '', address: '' });
    const [profileReady, setProfileReady] = useState(false);
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
            return;
        }
        if (user) {
            getUserProfile()
                .then(data => {
                    setProfile({
                        name: data.name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        address: data.address || '',
                    });
                })
                .catch(() => {
                    setProfile({ name: user.name || '', email: user.email || '', phone: '', address: '' });
                })
                .finally(() => setProfileReady(true));
        }
    }, [user, authLoading, navigate]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            await updateUserProfile({ name: profile.name, phone: profile.phone, address: profile.address });
            setProfileSaved(true);
            toast('Profile updated successfully', 'success');
            setTimeout(() => setProfileSaved(false), 3000);
        } catch (err) {
            toast(err.message || 'Failed to update profile', 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        if (passwords.newPassword.length < 8) {
            toast('New password must be at least 8 characters', 'error');
            return;
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast('New passwords do not match', 'error');
            return;
        }
        setPasswordLoading(true);
        try {
            await updateUserPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
            toast('Password updated successfully', 'success');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast(err.message || 'Failed to update password', 'error');
        } finally {
            setPasswordLoading(false);
        }
    };

    const loadingAll = authLoading || (user && !profileReady);
    const displayName = profile.name || user?.name || '';
    const initial = (displayName || user?.email || 'U').trim().charAt(0).toUpperCase();

    const fieldSkeleton = (tall) => <span className={`shimmer acc-sk-input${tall ? ' is-tall' : ''}`} aria-hidden="true" />;

    return (
        <div className="acc">
            <section className="acc-hero" aria-labelledby="acc-title">
                <div className="acc-inner">
                    <nav className="acc-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Settings</span>
                    </nav>
                    <div className="acc-who">
                        {loadingAll
                            ? <span className="shimmer acc-avatar" aria-hidden="true" />
                            : <span className="acc-avatar" aria-hidden="true">{initial}</span>}
                        <div>
                            <h1 id="acc-title" className="acc-title">Account settings</h1>
                            <p className="acc-lede">
                                {loadingAll ? <span className="shimmer acc-sk-lede" aria-hidden="true" /> : (profile.email || user?.email)}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="acc-body" aria-label="Settings">
                <div className="acc-inner acc-settings">
                    {/* Profile */}
                    <form className="acc-panel" onSubmit={handleProfileSave} aria-labelledby="acc-profile-title">
                        <div className="acc-panel-head">
                            <h2 id="acc-profile-title" className="acc-h2">Profile</h2>
                            <p className="acc-muted">Used on your orders and for shipping.</p>
                        </div>

                        <label className="acc-field">
                            <span className="acc-label">Full name</span>
                            {loadingAll ? fieldSkeleton() : (
                                <input type="text" autoComplete="name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" />
                            )}
                        </label>

                        <label className="acc-field">
                            <span className="acc-label">Email</span>
                            {loadingAll ? fieldSkeleton() : (
                                <input type="email" value={profile.email} readOnly aria-describedby="acc-email-hint" className="is-readonly" />
                            )}
                            <span id="acc-email-hint" className="acc-hint">Your email can't be changed.</span>
                        </label>

                        <label className="acc-field">
                            <span className="acc-label">Phone</span>
                            {loadingAll ? fieldSkeleton() : (
                                <input type="tel" autoComplete="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                            )}
                        </label>

                        <label className="acc-field">
                            <span className="acc-label">Shipping address</span>
                            {loadingAll ? fieldSkeleton(true) : (
                                <textarea rows={3} autoComplete="street-address" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} placeholder="Street, city, state, ZIP" />
                            )}
                        </label>

                        <div className="acc-panel-foot">
                            <button type="submit" className="acc-btn is-primary" disabled={profileLoading || loadingAll}>
                                {profileLoading ? <Loader2 size={16} className="acc-spin" aria-hidden="true" /> : profileSaved ? <CheckCircle size={16} aria-hidden="true" /> : null}
                                {profileLoading ? 'Saving' : profileSaved ? 'Saved' : 'Save profile'}
                            </button>
                        </div>
                    </form>

                    {/* Password */}
                    <form className="acc-panel" onSubmit={handlePasswordSave} aria-labelledby="acc-password-title">
                        <div className="acc-panel-head">
                            <h2 id="acc-password-title" className="acc-h2">Password</h2>
                            <p className="acc-muted">At least 8 characters.</p>
                        </div>

                        <PasswordField
                            label="Current password"
                            value={passwords.currentPassword}
                            onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                            autoComplete="current-password"
                            shown={showCurrent}
                            onToggle={() => setShowCurrent(v => !v)}
                        />
                        <PasswordField
                            label="New password"
                            value={passwords.newPassword}
                            onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            shown={showNew}
                            onToggle={() => setShowNew(v => !v)}
                        />
                        <PasswordField
                            label="Confirm new password"
                            value={passwords.confirmPassword}
                            onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                            autoComplete="new-password"
                            shown={showNew}
                        />

                        <div className="acc-panel-foot">
                            <button type="submit" className="acc-btn" disabled={passwordLoading}>
                                {passwordLoading && <Loader2 size={16} className="acc-spin" aria-hidden="true" />}
                                {passwordLoading ? 'Updating' : 'Update password'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    );
}
