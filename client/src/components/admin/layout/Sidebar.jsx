import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_SECTIONS } from './navigation';

/**
 * The admin menu. On wide screens it is a column that can shrink to an icon
 * rail (collapsed); on narrow screens it is a drawer (drawer + open) that
 * slides over the page and closes after a pick.
 */
export default function Sidebar({ drawer = false, open = false, collapsed = false, onToggleCollapsed, onClose, closeRef }) {
    const rail = !drawer && collapsed;
    const hidden = drawer && !open;
    const navRef = useRef(null);
    const { pathname } = useLocation();

    // The menu scrolls on short screens: keep the current page in view.
    useEffect(() => {
        navRef.current?.querySelector('.admin-nav-item.is-active')?.scrollIntoView({ block: 'nearest' });
    }, [pathname, open]);

    return (
        <aside
            id="admin-sidebar"
            className="admin-sidebar"
            aria-label="Admin menu"
            role={drawer ? 'dialog' : undefined}
            aria-modal={drawer && open ? true : undefined}
            inert={hidden || undefined}
        >
            <div className="admin-sidebar-head">
                <Link to="/admin" className="admin-brand" aria-label="DMS Admin, dashboard" onClick={drawer ? onClose : undefined}>
                    <span className="admin-brand-text" aria-hidden="true">DMS <span>Admin</span></span>
                </Link>
                {drawer && (
                    <button ref={closeRef} type="button" className="admin-sidebar-btn" onClick={onClose} aria-label="Close menu">
                        <X size={18} aria-hidden="true" />
                    </button>
                )}
            </div>

            <nav ref={navRef} className="admin-nav" aria-label="Admin pages">
                {NAV_SECTIONS.map(section => (
                    <div key={section.key} className="admin-nav-section">
                        {section.label && <p className="admin-nav-heading" id={`admin-nav-${section.key}`}>{section.label}</p>}
                        <ul className="admin-nav-list" aria-labelledby={section.label ? `admin-nav-${section.key}` : undefined}>
                            {section.items.map(item => {
                                const Icon = item.icon;
                                return (
                                    <li key={item.to}>
                                        <NavLink
                                            to={item.to}
                                            end={item.end}
                                            className={({ isActive }) => `admin-nav-item${isActive ? ' is-active' : ''}`}
                                            title={rail ? item.label : undefined}
                                            onClick={drawer ? onClose : undefined}
                                        >
                                            <Icon size={18} className="admin-nav-icon" aria-hidden="true" />
                                            <span className="admin-nav-label">{item.label}</span>
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {!drawer && (
                <div className="admin-sidebar-foot">
                    <button
                        type="button"
                        className="admin-nav-item admin-collapse-btn"
                        onClick={onToggleCollapsed}
                        aria-expanded={!collapsed}
                        title={rail ? 'Expand menu' : undefined}
                    >
                        {collapsed ? <PanelLeftOpen size={18} className="admin-nav-icon" aria-hidden="true" /> : <PanelLeftClose size={18} className="admin-nav-icon" aria-hidden="true" />}
                        <span className="admin-nav-label">{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
                    </button>
                </div>
            )}
        </aside>
    );
}
