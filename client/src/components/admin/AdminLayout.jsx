import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useToast } from '../../context/ToastContext';
// The admin kit (components/admin/ui) and its loading shimmer, for every admin screen.
import '../../styles/Shimmer.css';
import '../../styles/adminKit.css';
import './layout/adminShell.css';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import { breadcrumbsFor } from './layout/navigation';
import { useMediaQuery, useStoredFlag } from './layout/useShell';
import usePageTransition from '../../hooks/usePageTransition';

const NARROW = '(max-width: 1024px)';

/**
 * The frame around every admin page: the sectioned menu on the left (an
 * icon rail when collapsed, a drawer on narrow screens), the top bar with
 * breadcrumbs, the live-site link, the signed-in admin and log out, and the
 * scrolling content area the page renders into.
 */
export default function AdminLayout({ children }) {
    const { admin, logout } = useAdminAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const navigationType = useNavigationType();
    const { pathname } = useLocation();
    const pageRef = usePageTransition({ distance: 6, duration: 280 });
    const drawer = useMediaQuery(NARROW);
    const [collapsed, setCollapsed] = useStoredFlag('dms_admin_menu_collapsed');
    // The drawer stays open only on the page it was opened on, so picking a page closes it.
    const [drawerPath, setDrawerPath] = useState(null);
    const open = drawer && drawerPath === pathname;
    const [loggingOut, setLoggingOut] = useState(false);
    const menuButtonRef = useRef(null);
    const closeButtonRef = useRef(null);
    const contentRef = useRef(null);

    const closeDrawer = useCallback(() => setDrawerPath(null), []);

    // The drawer: focus its close button and let Escape close it; once it
    // closes, focus goes back to the menu button.
    const drawerWasOpen = useRef(false);
    useEffect(() => {
        if (!open) {
            if (drawerWasOpen.current) menuButtonRef.current?.focus();
            drawerWasOpen.current = false;
            return undefined;
        }
        drawerWasOpen.current = true;
        closeButtonRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, closeDrawer]);

    // The page scrolls inside the content area: start each new page at the top
    // (back/forward keeps where you were).
    useEffect(() => {
        if (navigationType !== 'POP') contentRef.current?.scrollTo(0, 0);
    }, [pathname, navigationType]);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await logout();
            navigate('/admin/login');
        } catch (err) {
            setLoggingOut(false);
            toast(`Could not log out: ${err.message}`, 'error');
        }
    };

    const classes = ['admin-shell', drawer ? 'is-drawer' : collapsed && 'is-collapsed', open && 'is-drawer-open'].filter(Boolean).join(' ');

    return (
        <div className={classes}>
            <a className="admin-skip" href="#admin-content">Skip to content</a>
            <Sidebar
                drawer={drawer}
                open={open}
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed(c => !c)}
                onClose={closeDrawer}
                closeRef={closeButtonRef}
            />
            {open && <div className="admin-scrim" onClick={closeDrawer} aria-hidden="true" />}
            <div className="admin-main" inert={open || undefined}>
                <Topbar
                    ref={menuButtonRef}
                    crumbs={breadcrumbsFor(pathname)}
                    admin={admin}
                    showMenuButton={drawer}
                    menuOpen={open}
                    onOpenMenu={() => setDrawerPath(pathname)}
                    onLogout={handleLogout}
                    loggingOut={loggingOut}
                />
                <main ref={contentRef} id="admin-content" className="admin-content" tabIndex={-1}>
                    <div ref={pageRef} className="admin-content-inner">{children}</div>
                </main>
            </div>
        </div>
    );
}
