import { ORDER_STATUSES, countsTowardRevenue, withinDays } from '../people/format';

/**
 * What the dashboard needs from the order list (ordersService.list()):
 * counts by status, sales in the last 30 days (rejected left out), the
 * oldest order still waiting for review, the newest first.
 */
export function summarizeOrders(result) {
    const byStatus = Object.fromEntries(ORDER_STATUSES.map(s => [s.key, 0]));
    const empty = { ready: Boolean(result), error: result?.error?.message || '', rows: [], byStatus, total: 0, trash: 0, last30: { total: 0, count: 0 }, oldestPending: null };
    if (!result || result.error) return empty;

    const rows = [...(result.value?.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    rows.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    const recent = rows.filter(o => withinDays(o.created_at, 30) && countsTowardRevenue(o));
    const pending = rows.filter(o => o.status === 'pending');
    return {
        ...empty,
        rows,
        byStatus,
        total: rows.length,
        trash: Number(result.value?.counts?.trash) || 0,
        last30: { total: recent.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0), count: recent.length },
        oldestPending: pending.length ? pending[pending.length - 1] : null,
    };
}
