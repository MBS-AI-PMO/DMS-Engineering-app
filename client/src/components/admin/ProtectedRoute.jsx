import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function ProtectedRoute({ children }) {
    const { admin, loading } = useAdminAuth();

    if (loading) {
        return (
            <div className="admin-auth-skeleton" aria-label="Loading admin dashboard">
                <aside className="admin-auth-skeleton-sidebar">
                    {[...Array(6)].map((_, idx) => (
                        <div key={idx} className="skeleton admin-auth-skeleton-nav" />
                    ))}
                </aside>
                <main className="admin-auth-skeleton-main">
                    <div className="skeleton admin-auth-skeleton-title" />
                    <div className="admin-auth-skeleton-cards">
                        {[...Array(3)].map((_, idx) => (
                            <div key={idx} className="skeleton admin-auth-skeleton-card" />
                        ))}
                    </div>
                    <div className="skeleton admin-auth-skeleton-table" />
                </main>
            </div>
        );
    }

    if (!admin || admin.role !== 'admin') {
        return <Navigate to="/admin/login" replace />;
    }

    return children;
}
