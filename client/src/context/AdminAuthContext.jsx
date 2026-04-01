import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAdminMe, adminLogin as apiAdminLogin, adminLogout as apiAdminLogout } from '../utils/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAdminMe()
            .then(({ user }) => setAdmin(user))
            .catch(() => setAdmin(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const { user } = await apiAdminLogin(email, password);
        setAdmin(user);
        return user;
    }, []);

    const logout = useCallback(async () => {
        await apiAdminLogout();
        setAdmin(null);
    }, []);

    return (
        <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth() {
    return useContext(AdminAuthContext);
}
