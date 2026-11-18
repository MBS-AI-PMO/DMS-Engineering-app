import {
    LayoutDashboard, ShoppingBag, MessageSquareQuote, Users, AtSign, Box, Tag, Wrench, Images, Calculator,
    BadgePercent, HelpCircle, FolderOpen, FileText, Scale, Contact, Globe, ShieldCheck, Mail, CreditCard, Newspaper,
} from 'lucide-react';

/*
 * The admin menu, in sections. The sidebar draws it and the topbar's
 * breadcrumb is read from it, so every admin route belongs to one item.
 * Pages use the same icon in their PageHeader.
 *
 * item: { to, label, icon, end?, detail?(segments) -> [labels] }
 * detail names the crumbs after the item for deeper routes
 * (/admin/orders/70 -> "Orders › #70").
 */

const titleCase = (segment) => {
    const words = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
const byNumber = (segments) => segments.map(s => (/^\d+$/.test(s) ? `#${s}` : titleCase(s)));
const editOrNew = (noun) => ([first, ...rest]) => [
    first === 'new' ? `New ${noun}` : `Edit ${noun}`,
    ...rest.map(titleCase),
];

export const NAV_SECTIONS = [
    {
        key: 'home',
        label: null,
        items: [
            { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        ],
    },
    {
        key: 'sales',
        label: 'Sales',
        items: [
            { to: '/admin/orders', label: 'Orders', icon: ShoppingBag, detail: byNumber },
            { to: '/admin/quotes', label: 'Quote requests', icon: MessageSquareQuote, detail: byNumber },
            { to: '/admin/customers', label: 'Customers', icon: Users },
            { to: '/admin/subscribers', label: 'Subscribers', icon: AtSign },
        ],
    },
    {
        key: 'catalog',
        label: 'Catalog',
        items: [
            { to: '/admin/metals', label: 'Metals', icon: Box, detail: editOrNew('metal') },
            { to: '/admin/categories', label: 'Categories', icon: Tag },
            { to: '/admin/services', label: 'Services', icon: Wrench, detail: editOrNew('service') },
            { to: '/admin/hero-sections', label: 'Hero sections', icon: Images },
        ],
    },
    {
        key: 'pricing',
        label: 'Pricing',
        items: [
            { to: '/admin/costing', label: 'Costing', icon: Calculator },
            { to: '/admin/pricing', label: 'Discounts', icon: BadgePercent },
        ],
    },
    {
        key: 'content',
        label: 'Content',
        items: [
            { to: '/admin/blog', label: 'Blog', icon: Newspaper, detail: editOrNew('post') },
            { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
            { to: '/admin/faq-categories', label: 'FAQ categories', icon: FolderOpen },
            { to: '/admin/guidelines', label: 'Guidelines', icon: FileText, detail: editOrNew('guideline') },
            { to: '/admin/legal', label: 'Terms & policy', icon: Scale },
            { to: '/admin/contact', label: 'Contact', icon: Contact },
            { to: '/admin/seo', label: 'SEO & tracking', icon: Globe },
        ],
    },
    {
        key: 'settings',
        label: 'Settings',
        items: [
            { to: '/admin/admins', label: 'Admins', icon: ShieldCheck },
            { to: '/admin/email', label: 'Email', icon: Mail },
            { to: '/admin/payment', label: 'Payment methods', icon: CreditCard },
        ],
    },
];

/** The menu item for a path (the longest match), or null. */
export function findNavItem(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    let best = null;
    for (const section of NAV_SECTIONS) {
        for (const item of section.items) {
            const hit = item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
            if (hit && (!best || item.to.length > best.item.to.length)) best = { section, item };
        }
    }
    return best;
}

/**
 * Breadcrumbs for a path: [{ label, to? }]. The section comes first (no
 * link), then the page (a link when there is more after it), then details.
 */
export function breadcrumbsFor(pathname) {
    const found = findNavItem(pathname);
    if (!found) return [{ label: 'Admin' }];
    const { section, item } = found;
    const rest = pathname.replace(/\/+$/, '').slice(item.to.length).split('/').filter(Boolean);
    const details = rest.length ? (item.detail || byNumber)(rest) : [];
    return [
        ...(section.label ? [{ label: section.label, isSection: true }] : []),
        { label: item.label, to: details.length ? item.to : undefined },
        ...details.map(label => ({ label })),
    ];
}
