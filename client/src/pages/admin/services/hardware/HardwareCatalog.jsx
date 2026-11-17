import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Cpu, Package } from 'lucide-react';
import { Banner, Button, Card, EmptyState, Skeleton } from '../../../../components/admin/ui';
import { hardwareService } from '../../../../services/admin/services';
import HardwareItems from './HardwareItems';

/**
 * The hardware insertion catalog (studs, standoffs, nuts…) edited from the
 * Hardware service. Pick a type, then manage its items. Unlike the rest of
 * the service form, these changes are saved as you make them.
 */
export default function HardwareCatalog() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const fetchTypes = useCallback(() => hardwareService.types()
        .then(rows => { setTypes((rows || []).filter(t => !t.name?.toLowerCase().includes('countersink'))); setError(''); })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false)), []);

    useEffect(() => { fetchTypes(); }, [fetchTypes]);
    const retry = () => { setLoading(true); setError(''); fetchTypes(); };

    const selected = types.find(t => t.id === selectedId) || null;
    const updateType = useCallback((next) => setTypes(prev => prev.map(t => (t.id === next.id ? next : t))), []);

    return (
        <Card title="Hardware catalog" icon={Cpu} subtitle="Hardware types and their sizes, offered in the quote flow. Changes here are saved straight away.">
            {error && <Banner tone="error" action={<Button size="sm" onClick={retry}>Try again</Button>}>Could not load the hardware types. {error}</Banner>}
            {selected ? (
                <HardwareItems key={selected.id} type={selected} onBack={() => setSelectedId(null)} onTypeChange={updateType} />
            ) : loading ? (
                <div className="cat-tile-grid">{[0, 1, 2, 3].map(i => <div key={i} className="cat-tile is-static"><Skeleton width="100%" size="lg" /></div>)}</div>
            ) : types.length === 0 ? (
                <EmptyState icon={Package} title="No hardware types">Hardware types are added to the database by the developers.</EmptyState>
            ) : (
                <div className="cat-tile-grid">
                    {types.map(t => (
                        <button key={t.id} type="button" className="cat-tile" onClick={() => setSelectedId(t.id)}>
                            {t.image_path ? <img className="cat-tile-img" src={t.image_path} alt="" loading="lazy" /> : <span className="cat-tile-img is-empty" aria-hidden="true"><Package size={18} /></span>}
                            <span className="cat-tile-text">
                                <span className="ak-cell-main">{t.name}</span>
                                <span className="ak-cell-sub">{Number(t.item_count) || 0} {Number(t.item_count) === 1 ? 'item' : 'items'}</span>
                            </span>
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            )}
        </Card>
    );
}
