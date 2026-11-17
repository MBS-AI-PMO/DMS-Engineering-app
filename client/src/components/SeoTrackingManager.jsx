import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchSettings } from '../utils/api';
import { applySeo, isAdminPath, SEO_SETTINGS_SAVED_EVENT } from '../utils/seo';
import { initTracking, disableTracking, trackPageView } from '../utils/tracking';

/**
 * Renders nothing. Loads the admin-managed `seo_meta` and `tracking_pixels`
 * settings once, then on every route change applies the page's meta tags and
 * (outside /admin) loads the enabled pixels and sends a page view.
 */
export default function SeoTrackingManager() {
    const location = useLocation();
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = (initial) => fetchSettings()
            .then(data => { if (!cancelled) setSettings(data || {}); })
            .catch(() => {
                if (cancelled || !initial) return;
                disableTracking();
                setSettings({});
            });
        load(true);
        // The admin SEO page announces saves so this tab picks them up without a reload.
        const reload = () => load(false);
        window.addEventListener(SEO_SETTINGS_SAVED_EVENT, reload);
        return () => {
            cancelled = true;
            window.removeEventListener(SEO_SETTINGS_SAVED_EVENT, reload);
        };
    }, []);

    useEffect(() => {
        if (!settings) return;
        applySeo(settings.seo_meta, location.pathname);
        if (isAdminPath(location.pathname)) return;
        initTracking(settings.tracking_pixels);
        trackPageView(location.pathname + location.search, document.title, location.key);
    }, [settings, location.pathname, location.search, location.key]);

    return null;
}
