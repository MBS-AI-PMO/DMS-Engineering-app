import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink, LogOut, Menu } from 'lucide-react';
import { Avatar } from '../ui';

/** Where you are: "Sales › Orders › #70". The last crumb is the current page. */
function Breadcrumbs({ crumbs }) {
    return (
        <nav className="admin-crumbs" aria-label="Breadcrumb">
            <ol>
                {crumbs.map((crumb, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                        <li key={`${crumb.label}-${i}`} className={crumb.isSection ? 'is-section' : undefined}>
                            {i > 0 && <ChevronRight size={14} className="admin-crumb-sep" aria-hidden="true" />}
                            {last ? <span aria-current="page" className="admin-crumb-current">{crumb.label}</span>
                                : crumb.to ? <Link to={crumb.to}>{crumb.label}</Link>
                                    : <span>{crumb.label}</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/**
 * The bar above every admin page: the menu button (narrow screens),
 * breadcrumbs, a link to the live site, who is signed in, and log out.
 */
const Topbar = forwardRef(function Topbar({ crumbs, admin, showMenuButton, menuOpen, onOpenMenu, onLogout, loggingOut }, menuButtonRef) {
    const name = admin?.name?.trim() || admin?.email || 'Admin';
    return (
        <header className="admin-topbar">
            {showMenuButton && (
                <button
                    ref={menuButtonRef}
                    type="button"
                    className="admin-topbar-btn"
                    onClick={onOpenMenu}
                    aria-label="Open menu"
                    aria-controls="admin-sidebar"
                    aria-expanded={menuOpen}
                >
                    <Menu size={20} aria-hidden="true" />
                </button>
            )}
            <Breadcrumbs crumbs={crumbs} />
            <div className="admin-topbar-tools">
                <a className="admin-topbar-link" href="/" target="_blank" rel="noopener noreferrer" title="Open the live site in a new tab">
                    <ExternalLink size={16} aria-hidden="true" />
                    <span className="admin-topbar-text">View site</span>
                    <span className="ak-sr"> (opens in a new tab)</span>
                </a>
                <div className="admin-user" title={admin?.email || undefined}>
                    <Avatar name={name} />
                    <span className="admin-user-text">
                        <span className="admin-user-name">{name}</span>
                        {admin?.email && admin.email !== name && <span className="admin-user-email">{admin.email}</span>}
                    </span>
                </div>
                <button type="button" className="admin-topbar-link" onClick={onLogout} disabled={loggingOut} title="Log out">
                    <LogOut size={16} aria-hidden="true" />
                    <span className="admin-topbar-text">{loggingOut ? 'Logging out…' : 'Log out'}</span>
                </button>
            </div>
        </header>
    );
});

export default Topbar;
