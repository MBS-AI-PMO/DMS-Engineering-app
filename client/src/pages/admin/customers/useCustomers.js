import { useCallback, useEffect, useState } from 'react';
import { customersService } from '../../../services/admin/customers';
import { ordersService } from '../../../services/admin/orders';
import { countsTowardRevenue } from '../people/format';

const lower = (s) => String(s || '').trim().toLowerCase();

/*
 * Each customer with their orders: ones placed while signed in (user_id),
 * plus guest orders under the same email. spent leaves rejected orders out.
 */
function withOrders(customers, orders) {
    if (!orders) return customers.map(c => ({ ...c, orders: null, orderCount: null, spent: null }));
    const byUser = new Map();
    const byEmail = new Map();
    orders.forEach(o => {
        const bucket = o.user_id ? byUser : byEmail;
        const key = o.user_id || lower(o.email);
        if (!bucket.has(key)) bucket.set(key, []);
        bucket.get(key).push(o);
    });
    return customers.map(c => {
        const list = [...(byUser.get(c.id) || []), ...(byEmail.get(lower(c.email)) || [])]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const spent = list.filter(countsTowardRevenue).reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        return { ...c, orders: list, orderCount: list.length, spent };
    });
}

/** Customers (newest first) joined with their orders. Orders failing to load is not fatal. */
export function useCustomers() {
    const [state, setState] = useState({ loading: true, error: '', ordersError: '', customers: [] });

    const load = useCallback(() => Promise.allSettled([customersService.list(), ordersService.list()])
        .then(([customers, orders]) => {
            if (customers.status === 'rejected') {
                setState({ loading: false, error: customers.reason.message, ordersError: '', customers: [] });
                return;
            }
            const orderRows = orders.status === 'fulfilled' ? orders.value?.data || [] : null;
            setState({
                loading: false,
                error: '',
                ordersError: orders.status === 'rejected' ? orders.reason.message : '',
                customers: withOrders(customers.value || [], orderRows),
            });
        }), []);

    useEffect(() => { load(); }, [load]);

    const reload = useCallback(() => {
        setState(s => ({ ...s, loading: true, error: '' }));
        load();
    }, [load]);

    return { ...state, reload };
}
