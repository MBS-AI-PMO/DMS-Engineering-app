/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Lock, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateUserProfile, updateUserPassword } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';

const SettingsSkeleton = () => (
    <div className="settings-page">
        <div className="settings-hero">
            <div className="container">
                <div className="settings-hero-content settings-hero-skeleton">
                    <Skeleton dark variant="rectangle" style={{ width: 64, height: 64, borderRadius: 18, flexShrink: 0 }} />
                    <div className="settings-skeleton-copy">
                        <Skeleton dark variant="text" style={{ width: 220, height: 32, marginBottom: 10 }} />
                        <Skeleton dark variant="text" style={{ width: 320, maxWidth: '70vw', height: 14 }} />
                    </div>
                </div>
            </div>
        </div>

        <div className="container settings-container">
            <div className="settings-grid">
                {[0, 1].map(card => (
                    <div key={card} className="settings-card settings-card-skeleton">
                        <div className="settings-card-header">
                            <Skeleton dark variant="rectangle" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
                            <div className="settings-skeleton-copy">
                                <Skeleton dark variant="text" style={{ width: 190, height: 20, marginBottom: 9 }} />
                                <Skeleton dark variant="text" style={{ width: 240, maxWidth: '100%', height: 12 }} />
                            </div>
                        </div>

                        <div className="settings-form">
                            {[0, 1, 2, 3].map(row => (
                                <div key={row} className="settings-field">
                                    <Skeleton dark variant="text" style={{ width: 96, height: 11 }} />
                                    <Skeleton dark variant="rectangle" style={{ width: '100%', height: row === 3 ? 82 : 45, borderRadius: 11 }} />
                                </div>
                            ))}
                            <Skeleton dark variant="rectangle" style={{ width: 170, height: 44, borderRadius: 11 }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default function Settings() {
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({ name: '', email: '', phone: '', address: '' });
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
                });
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

    if (authLoading) return <SettingsSkeleton />;

    const firstName = user?.name?.split(' ')[0] || 'User';

    return (
        <div className="settings-page">
            <div className="settings-hero">
                <div className="container">
                    <motion.div
                        className="settings-hero-content"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="settings-avatar">
                            {(firstName?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                            <h1>Account Settings</h1>
                            <p>Manage your profile and security for {user?.email}</p>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="container settings-container">
                <div className="settings-grid">

                    {/* Personal Information */}
                    <motion.div
                        className="settings-card"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <div className="settings-card-header">
                            <div className="settings-card-icon">
                                <User size={20} />
                            </div>
                            <div>
                                <h2>Personal Information</h2>
                                <p>Update your name and contact details</p>
                            </div>
                        </div>

                        <form onSubmit={handleProfileSave} className="settings-form">
                            <div className="settings-field">
                                <label>Full Name</label>
                                <div className="settings-input-wrapper">
                                    <User size={16} className="settings-input-icon" />
                                    <input
                                        type="text"
                                        value={profile.name}
                                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Your full name"
                                    />
                                </div>
                            </div>

                            <div className="settings-field">
                                <label>Email Address</label>
                                <div className="settings-input-wrapper settings-input-readonly">
                                    <Mail size={16} className="settings-input-icon" />
                                    <input
                                        type="email"
                                        value={profile.email}
                                        readOnly
                                        title="Email cannot be changed"
                                    />
                                </div>
                                <span className="settings-field-hint">Email address cannot be changed</span>
                            </div>

                            <div className="settings-field">
                                <label>Phone Number</label>
                                <div className="settings-input-wrapper">
                                    <Phone size={16} className="settings-input-icon" />
                                    <input
                                        type="tel"
                                        value={profile.phone}
                                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            <div className="settings-field">
                                <label>Shipping Address</label>
                                <div className="settings-input-wrapper settings-textarea-wrapper">
                                    <MapPin size={16} className="settings-input-icon settings-input-icon-top" />
                                    <textarea
                                        value={profile.address}
                                        onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                                        placeholder="123 Main St, City, State, ZIP"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="settings-save-btn" disabled={profileLoading}>
                                {profileLoading ? (
                                    <span className="settings-btn-spinner" />
                                ) : profileSaved ? (
                                    <>
                                        <CheckCircle size={18} />
                                        Saved
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>

                    {/* Password & Security */}
                    <motion.div
                        className="settings-card"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <div className="settings-card-header">
                            <div className="settings-card-icon settings-card-icon-red">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h2>Password & Security</h2>
                                <p>Update your password to keep your account secure</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordSave} className="settings-form">
                            <div className="settings-field">
                                <label>Current Password</label>
                                <div className="settings-input-wrapper">
                                    <Lock size={16} className="settings-input-icon" />
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={passwords.currentPassword}
                                        onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                                        placeholder="Enter current password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="settings-eye-btn"
                                        onClick={() => setShowCurrent(v => !v)}
                                        tabIndex={-1}
                                    >
                                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            <div className="settings-field">
                                <label>New Password</label>
                                <div className="settings-input-wrapper">
                                    <Lock size={16} className="settings-input-icon" />
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={passwords.newPassword}
                                        onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                                        placeholder="Min. 8 characters"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="settings-eye-btn"
                                        onClick={() => setShowNew(v => !v)}
                                        tabIndex={-1}
                                    >
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            <div className="settings-field">
                                <label>Confirm New Password</label>
                                <div className="settings-input-wrapper">
                                    <Lock size={16} className="settings-input-icon" />
                                    <input
                                        type="password"
                                        value={passwords.confirmPassword}
                                        onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                                        placeholder="Repeat new password"
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="settings-save-btn settings-save-btn-secondary" disabled={passwordLoading}>
                                {passwordLoading ? (
                                    <span className="settings-btn-spinner" />
                                ) : (
                                    <>
                                        <Lock size={18} />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
