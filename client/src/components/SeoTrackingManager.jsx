import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchSettings } from '../utils/api';
import { applyHeadTags, applySeo, isAdminPath, SEO_ROUTE_EVENT, SEO_SETTINGS_SAVED_EVENT } from '../utils/seo';
import { clearPageHeadCache, fetchPageHead } from '../services/pageHead';
import { initTracking, disableTracking, trackPageView } from '../utils/tracking';

/**
 * Renders nothing. On every route change it puts the page's <head> tags in
 * place: the list the server built for that address (GET /api/seo/head, the
 * same tags the page HTML arrived with), swapping out the previous page's
 * (utils/seo applyHeadTags). If that request fails it falls back to the
 * app's own version from the `seo_meta` setting (applySeo, which also
 * follows a page's own setRouteSeo values). Then, outside /admin, it loads
 * the enabled `tracking_pixels` and sends a page view with the new title.
 */
export default function SeoTrackingManager() {
    const location = useLocation();
    const [settings, setSettings] = useState(null);
    const [routeTags, setRouteTags] = useState(0);
    const fromServer = useRef(false); // the tags in place are the server's list

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
        const reload = () => {
            clearPageHeadCache();
            load(false);
        };
        window.addEventListener(SEO_SETTINGS_SAVED_EVENT, reload);
        return () => {
            cancelled = true;
            window.removeEventListener(SEO_SETTINGS_SAVED_EVENT, reload);
        };
    }, []);

    useEffect(() => {
        if (!settings) return undefined;
        let current = true;
        const path = location.pathname;
        const onAdmin = isAdminPath(path);
        // Admin screens get the plain title straight away (some then set their own).
        if (onAdmin) applySeo(settings.seo_meta, path);
        else initTracking(settings.tracking_pixels);
        fetchPageHead(path)
            .then((head) => {
                if (!current) return;
                applyHeadTags(onAdmin ? { ...head, title: '' } : head);
                fromServer.current = true;
            })
            .catch(() => {
                if (!current) return;
                applySeo(settings.seo_meta, path);
                fromServer.current = false;
            })
            .finally(() => {
                if (current && !onAdmin) trackPageView(path + location.search, document.title, location.key);
            });
        return () => { current = false; };
    }, [settings, location.pathname, location.search, location.key]);

    // A page set its own title/description (e.g. a blog post once loaded).
    // The server's list already has them; this only matters in the fallback.
    useEffect(() => {
        const bump = () => setRouteTags(n => n + 1);
        window.addEventListener(SEO_ROUTE_EVENT, bump);
        return () => window.removeEventListener(SEO_ROUTE_EVENT, bump);
    }, []);
    useEffect(() => {
        if (settings && routeTags && !fromServer.current) applySeo(settings.seo_meta, window.location.pathname);
    }, [settings, routeTags]);

    return null;
}
