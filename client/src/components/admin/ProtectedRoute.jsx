import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function ProtectedRoute({ children }) {
    const { admin, loading } = useAdminAuth();

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-loading-spinner"></div>
            </div>
        );
    }

    if (!admin || admin.role !== 'admin') {
        return <Navigate to="/admin/login" replace />;
    }

    return children;
}
