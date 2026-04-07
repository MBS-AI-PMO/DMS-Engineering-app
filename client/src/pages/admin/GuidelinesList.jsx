import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Info, Loader2 } from 'lucide-react';
import { fetchGuidelines } from '../../utils/api';
import { TableRowSkeleton } from '../../components/admin/AdminSkeletons';
import { useToast } from '../../context/ToastContext';

export default function GuidelinesList() {
    const [guidelines, setGuidelines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    const toast = useToast();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchGuidelines();
            setGuidelines(data);
        } catch {
            toast('Failed to load guidelines', 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filtered = guidelines.filter(g =>
        g.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <h1 className="admin-page-title">Manufacturing Guidelines</h1>
            </div>

            <div className="admin-search-bar">
                <Search size={16} />
                <input
                    type="text"
                    placeholder="Search guidelines..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="admin-table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>ID</th>
                            <th>Requirements</th>
                            <th>Tables</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableRowSkeleton columns={5} rows={7} />
                        ) : (
                            filtered.map(g => (
                                <tr key={g.id}>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-blue-500" />
                                            <strong>{g.title}</strong>
                                        </div>
                                    </td>
                                    <td><code className="bg-gray-100 px-1 rounded">{g.service_id}</code></td>
                                    <td>
                                        <span className="badge">
                                            {Array.isArray(g.requirements) ? g.requirements.length : 0} items
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge secondary">
                                            {Array.isArray(g.tables) ? g.tables.length : 0} tables
                                        </span>
                                    </td>
                                    <td className="table-cell-muted">
                                        {new Date(g.updated_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button
                                                className="admin-btn-secondary btn-sm"
                                                onClick={() => navigate(`/admin/guidelines/${g.service_id}`)}
                                            >
                                                Configure
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!loading && filtered.length === 0 && (
                    <div className="admin-empty">No guidelines found matching your search.</div>
                )}
            </div>
        </div>
    );
}
