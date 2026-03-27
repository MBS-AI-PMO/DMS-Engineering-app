import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wrench, Scissors, Layers, ArrowRight, Settings2 } from 'lucide-react';

const cards = [
    {
        to: '/admin/configurations/cnc-machining',
        icon: Wrench,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.08)',
        title: 'CNC Machining',
        desc: 'Set global min/max sizing (X, Y, Z) and assign which metals are available for CNC machining jobs.',
    },
    {
        to: '/admin/configurations/sheet-cutting',
        icon: Scissors,
        color: '#e31b23',
        bg: 'rgba(227,27,35,0.08)',
        title: 'Sheet Cutting',
        desc: 'Set global min/max sizing (X, Y) and assign metals. Metals whose sizing fits these limits are auto-flagged.',
    },
    {
        to: '/admin/configurations/metals',
        icon: Layers,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.08)',
        title: 'Metal Sizing & Thicknesses',
        desc: 'Configure per-metal min/max sizing and available thicknesses. Sheet-cuttability is computed automatically.',
    },
];

export default function ConfigurationsHub() {
    const navigate = useNavigate();

    return (
        <div className="admin-list-page">
            <header className="admin-page-header">
                <div className="config-hub-header-left">
                    <Settings2 size={28} className="config-hub-title-icon" />
                    <div>
                        <h1 className="admin-page-title">Configurations</h1>
                        <p className="admin-page-subtitle">
                            Manage service sizing limits and metal assignments for the Instant Pricing flow.
                        </p>
                    </div>
                </div>
            </header>

            <div className="config-hub-grid">
                {cards.map(({ to, icon: Icon, color, bg, title, desc }, i) => (
                    <motion.div
                        key={to}
                        className="config-hub-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => navigate(to)}
                    >
                        <div className="config-hub-card-icon" style={{ background: bg, color }}>
                            <Icon size={26} />
                        </div>
                        <div className="config-hub-card-body">
                            <h3>{title}</h3>
                            <p>{desc}</p>
                        </div>
                        <ArrowRight size={18} className="config-hub-card-arrow" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
