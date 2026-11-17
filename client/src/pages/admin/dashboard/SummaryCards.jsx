import {
    AtSign, BadgePercent, Box, Calculator, Contact, CreditCard, FileText, FolderOpen, Globe, HelpCircle, Images, Layers,
    Newspaper, Scale, ShieldCheck, Tag, Users, Wrench,
} from 'lucide-react';
import { Card } from '../../../components/admin/ui';
import { plural, withinDays } from '../people/format';
import { countOf } from './useDashboard';
import LinkList from './LinkList';

/* "2 new in 30 days" from a list source, or nothing. */
const newIn30 = (result, field) => {
    if (!Array.isArray(result?.value)) return undefined;
    const n = result.value.filter(r => withinDays(r[field], 30)).length;
    return n ? `${n} new in 30 days` : 'None new in 30 days';
};

/** Metals, categories, services, hero images (with counts) and the pricing pages. */
export function CatalogCard({ data }) {
    const services = Array.isArray(data.services?.value) ? data.services.value : null;
    const heroes = Array.isArray(data.heroSections?.value) ? data.heroSections.value : null;
    const withImage = heroes ? heroes.filter(h => h.hero_image?.src || h.hero_image?.webp || h.hero_image?.avif || h.hero_image?.jpg).length : null;
    const hidden = services ? services.filter(s => s.is_active === false).length : 0;
    return (
        <Card title="Catalog & pricing" icon={Layers}>
            <LinkList items={[
                { to: '/admin/metals', icon: Box, label: 'Metals', value: countOf(data.metals) },
                { to: '/admin/categories', icon: Tag, label: 'Categories', value: countOf(data.categories) },
                { to: '/admin/services', icon: Wrench, label: 'Services', sub: hidden ? `${hidden} hidden from the site` : undefined, value: countOf(data.services) },
                {
                    to: '/admin/hero-sections', icon: Images, label: 'Hero sections',
                    sub: heroes ? `${withImage} of ${plural(heroes.length, 'service')} have an image` : undefined,
                    value: data.heroSections === undefined ? undefined : withImage,
                },
                { to: '/admin/costing', icon: Calculator, label: 'Costing' },
                { to: '/admin/pricing', icon: BadgePercent, label: 'Discounts' },
            ]} />
        </Card>
    );
}

/** FAQs, guidelines and the site's text pages. */
export function ContentCard({ data }) {
    return (
        <Card title="Content" icon={Newspaper}>
            <LinkList items={[
                { to: '/admin/faqs', icon: HelpCircle, label: 'FAQs', value: countOf(data.faqs) },
                { to: '/admin/faq-categories', icon: FolderOpen, label: 'FAQ categories', value: countOf(data.faqCategories) },
                { to: '/admin/guidelines', icon: FileText, label: 'Guidelines', value: countOf(data.guidelines) },
                { to: '/admin/legal', icon: Scale, label: 'Terms & policy' },
                { to: '/admin/contact', icon: Contact, label: 'Contact' },
                { to: '/admin/seo', icon: Globe, label: 'SEO & tracking' },
            ]} />
        </Card>
    );
}

/* Which ways to pay are on at checkout. */
function paymentSummary(settings) {
    if (!settings?.value) return { sub: undefined, value: settings?.error ? null : undefined };
    const on = [settings.value.payment_cod_enabled && 'Cash on delivery', settings.value.payment_paypal_enabled && 'PayPal'].filter(Boolean);
    return { sub: on.length ? `${on.join(' and ')} on` : 'None turned on', value: `${on.length} on` };
}

/** Customers, newsletter subscribers, admins and the ways to pay. */
export function PeopleCard({ data }) {
    const payment = paymentSummary(data.settings);
    return (
        <Card title="People & settings" icon={Users}>
            <LinkList items={[
                { to: '/admin/customers', icon: Users, label: 'Customers', sub: newIn30(data.customers, 'created_at'), value: countOf(data.customers) },
                { to: '/admin/subscribers', icon: AtSign, label: 'Subscribers', sub: newIn30(data.subscribers, 'subscribed_at'), value: countOf(data.subscribers) },
                { to: '/admin/admins', icon: ShieldCheck, label: 'Admins', value: countOf(data.admins) },
                { to: '/admin/payment', icon: CreditCard, label: 'Payment methods', sub: payment.sub, value: payment.value },
            ]} />
        </Card>
    );
}
