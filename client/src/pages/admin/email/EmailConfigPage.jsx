import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, RotateCcw } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { Banner, Button, Card, Page, PageHeader, Pill, SideLayout, Skeleton, Stack, useConfirm } from '../../../components/admin/ui';
import { emailService } from '../../../services/admin/email';
import SmtpSettingsCard from './SmtpSettingsCard';
import EmailChecksCard from './EmailChecksCard';
import EmailTemplatesCard from './EmailTemplatesCard';
import EmailProblem from './EmailProblem';
import './email.css';

const when = (at) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Admin > Email (/admin/email): the account every site email is sent from,
 * checks for it, and a preview of each email. When emails are failing (a
 * check failed, or recent order emails did) the reason and its fix are the
 * first thing on the page; for a Gmail password that is the app password,
 * step by step.
 */
export default function EmailConfigPage() {
    const toast = useToast();
    const [confirm, confirmDialog] = useConfirm();
    const [config, setConfig] = useState(undefined); // undefined = loading, null = none saved
    const [status, setStatus] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [problem, setProblem] = useState(null);     // { message, context } from a check
    const [checkPassed, setCheckPassed] = useState(false);
    const [dirty, setDirty] = useState(false);
    const passwordRef = useRef(null);

    const load = useCallback(() => {
        emailService.config()
            .then(data => { setConfig(data); setLoadError(''); })
            .catch(err => setLoadError(err.message));
        emailService.status().then(setStatus).catch(() => setStatus(undefined));
    }, []);
    useEffect(() => { load(); }, [load]);

    const focusPassword = () => {
        passwordRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        passwordRef.current?.focus({ preventScroll: true });
    };

    const save = async (form) => {
        try {
            await emailService.save(form);
            setConfig(await emailService.config());
            setProblem(null);
            setCheckPassed(false);
            toast(form.password ? 'Saved. Press Test connection to check the password.' : 'Email settings saved', 'success');
            return true;
        } catch (err) {
            toast(`Could not save: ${err.message}`, 'error');
            return false;
        }
    };

    const remove = async () => {
        const yes = await confirm({
            title: 'Remove the sending account?',
            message: 'Order updates, new-order alerts, welcome emails, newsletter and website messages all stop sending until a new account is saved.',
            confirmLabel: 'Remove account',
            danger: true,
        });
        if (!yes) return;
        try {
            await emailService.remove();
            setConfig(null);
            toast('Sending account removed', 'success');
        } catch (err) {
            toast(`Could not remove it: ${err.message}`, 'error');
        }
    };

    const reportProblem = useCallback((p) => { setProblem(p); setCheckPassed(false); }, []);
    const topRef = useRef(null);
    // A new problem is explained at the top: bring it into view.
    useEffect(() => { if (problem) topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [problem]);
    const clearProblem = useCallback(() => { setProblem(null); setCheckPassed(true); }, []);

    const failing = status?.lastFailed && (!status.lastSent || new Date(status.lastFailed.at) > new Date(status.lastSent.at));
    const header = (
        <PageHeader
            icon={Mail}
            title={(
                <>
                    Email
                    {config === undefined ? null : config
                        ? (failing && !checkPassed ? <Pill tone="red" dot>Not sending</Pill> : <Pill tone="green" dot>Set up</Pill>)
                        : <Pill tone="amber" dot>Not set up</Pill>}
                </>
            )}
            subtitle="The account every site email is sent from: order updates, new-order alerts, welcome emails, newsletter sign-ups and website messages."
        />
    );

    if (loadError && config === undefined) {
        return (
            <Page>
                {header}
                <Banner tone="error" action={<Button size="sm" icon={RotateCcw} onClick={load}>Try again</Button>}>Could not load the email settings: {loadError}</Banner>
            </Page>
        );
    }

    if (config === undefined) {
        return (
            <Page busy>
                {header}
                <SideLayout
                    main={<Card><Skeleton width="30%" size="lg" /><Skeleton size="block" /></Card>}
                    side={<Card><Skeleton width="50%" /><Skeleton size="block" /></Card>}
                />
            </Page>
        );
    }

    // The problem to explain first: a failed check, else order emails that keep failing.
    let top = null;
    if (problem) {
        top = <EmailProblem message={problem.message} context={problem.context} config={config} onFix={focusPassword} />;
    } else if (failing && !checkPassed) {
        const count = status.failedSinceSent;
        top = (
            <EmailProblem
                message={status.lastFailed.error || 'Unknown error'}
                context={`Order emails are not going out: ${count} ${count === 1 ? 'has' : 'have'} failed${status.lastSent ? ` since ${when(status.lastSent.at)}` : ''}, the latest on ${when(status.lastFailed.at)}${status.lastFailed.to ? ` to ${status.lastFailed.to}` : ''}.`}
                config={config}
                onFix={focusPassword}
            />
        );
    } else if (failing && checkPassed) {
        top = (
            <Banner tone="success">
                The account works now. Emails that failed earlier were not re-sent; send them again from each order&apos;s page if needed.
            </Banner>
        );
    } else if (!config) {
        top = <Banner tone="warn">No sending account yet, so the site sends no emails. Fill it in below and save.</Banner>;
    }

    return (
        <Page>
            {header}
            <Stack>
                {top && <div ref={topRef} className="em-top">{top}</div>}
                <SideLayout
                    main={(
                        <SmtpSettingsCard
                            key={config?.updated_at || 'new'}
                            config={config}
                            onSave={save}
                            onRemove={remove}
                            onDirtyChange={setDirty}
                            passwordRef={passwordRef}
                        />
                    )}
                    side={(
                        <EmailChecksCard
                            config={config}
                            status={status}
                            dirty={dirty}
                            toast={toast}
                            onProblem={reportProblem}
                            onPassed={clearProblem}
                        />
                    )}
                />
                <EmailTemplatesCard config={config} dirty={dirty} toast={toast} onProblem={reportProblem} />
            </Stack>
            {confirmDialog}
        </Page>
    );
}
