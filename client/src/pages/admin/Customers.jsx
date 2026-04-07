import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';  // eslint-disable-line no-unused-vars
import { Users, Search, UserCheck, Phone, MapPin, Calendar, Mail, User } from 'lucide-react';
import { fetchCustomers } from '../../utils/api';
import { StatsCardSkeleton, CustomerRowSkeleton } from '../../components/admin/AdminSkeletons';
import { useToast } from '../../context/ToastContext';

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const toast = useToast();

    useEffect(() => {
        fetchCustomers()
            .then(data => setCustomers(data || []))
            .catch(err => toast('Failed to load customers: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    }, [toast]);

    const filtered = customers.filter(c => {
        const q = search.toLowerCase();
        return (
            (c.name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.address || '').toLowerCase().includes(q)
        );
    });

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="admin-list-page">
            <header className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Customers</h1>
                    <p className="admin-page-subtitle">{customers.length} registered customer{customers.length !== 1 ? 's' : ''}</p>
                </div>
            </header>

            {/* Stats row */}
            {loading ? (
                <div style={{ marginBottom: '24px' }}>
                    <StatsCardSkeleton count={3} />
                </div>
            ) : (
                <div className="customers-stats-row">
                    <motion.div
                        className="customers-stat-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <UserCheck size={22} />
                        <div>
                            <span className="customers-stat-num">{customers.length}</span>
                            <span className="customers-stat-label">Total Accounts</span>
                        </div>
                    </motion.div>
                    <motion.div
                        className="customers-stat-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Phone size={22} />
                        <div>
                            <span className="customers-stat-num">
                                {customers.filter(c => c.phone).length}
                            </span>
                            <span className="customers-stat-label">With Phone</span>
                        </div>
                    </motion.div>
                    <motion.div
                        className="customers-stat-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <MapPin size={22} />
                        <div>
                            <span className="customers-stat-num">
                                {customers.filter(c => c.address).length}
                            </span>
                            <span className="customers-stat-label">With Address</span>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Search */}
            <div className="customers-search-bar">
                <Search size={18} className="customers-search-icon" />
                <input
                    type="text"
                    placeholder="Search by name, email, phone, or address…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="customers-table-wrapper">
                <table className="customers-table">
                    <thead>
                        <tr>
                            <th><User size={14} /> Name</th>
                            <th><Mail size={14} /> Email</th>
                            <th><Phone size={14} /> Phone</th>
                            <th><MapPin size={14} /> Shipping Address</th>
                            <th><Calendar size={14} /> Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <CustomerRowSkeleton rows={8} />
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan="5">
                                    <div className="admin-empty-state">
                                        <Users size={40} />
                                        <p>{search ? 'No customers match your search.' : 'No registered customers yet.'}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((customer, i) => (
                                <motion.tr
                                    key={customer.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.02 * i }}
                                >
                                    <td>
                                        <div className="customer-name-cell">
                                            <div className="customer-avatar">
                                                {(customer.name || customer.email || '?')[0].toUpperCase()}
                                            </div>
                                            <span>{customer.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="customer-email">{customer.email}</td>
                                    <td>{customer.phone || <span className="customer-empty">—</span>}</td>
                                    <td className="customer-address">{customer.address || <span className="customer-empty">—</span>}</td>
                                    <td className="customer-date">{formatDate(customer.created_at)}</td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
