/*
 * Turns a mail error (from a test, a sample or an order email that failed)
 * into a plain title and the steps that fix it. The texts come from
 * backend/utils/email.js (classifyEmailError).
 */

export const GMAIL_APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords';
export const GMAIL_TWO_STEP_URL = 'https://myaccount.google.com/signinoptions/two-step-verification';

export const isGmail = (config) => /gmail\.com$/i.test(String(config?.smtp_host || '').trim())
    || /@(gmail|googlemail)\.com$/i.test(String(config?.email || '').trim());

/* kind: auth | not-configured | connection | tls | other */
export function classifyEmailError(message) {
    const text = String(message || '');
    if (/authentication failed|invalid login|username and password not accepted|EAUTH|535/i.test(text)) return 'auth';
    if (/not configured/i.test(text)) return 'not-configured';
    if (/refused|reset|timed out|not found|ENOTFOUND|ECONN/i.test(text)) return 'connection';
    if (/certificate|ssl|tls|protocol mismatch|wrong version/i.test(text)) return 'tls';
    return 'other';
}

/* { title, summary, steps?: [text], gmail?: true } for the panel that explains it. */
export function explainEmailError(message, config) {
    const kind = classifyEmailError(message);
    const gmail = isGmail(config);
    if (kind === 'auth' && gmail) {
        return {
            kind,
            gmail: true,
            title: 'Gmail rejected the password',
            summary: `Gmail does not accept the normal account password from a website. It needs an app password: a 16-letter code made for the account ${config?.email || ''}.`.replace(' .', '.'),
        };
    }
    if (kind === 'auth') {
        return {
            kind,
            title: 'The mail server rejected the email address or password',
            summary: 'Check both. Outlook, Yahoo, Zoho and most others need an app password (not the normal one) when 2-step sign-in is on.',
        };
    }
    if (kind === 'not-configured') {
        return { kind, title: 'No sending account yet', summary: 'Fill in the sending account below and save it.' };
    }
    if (kind === 'connection') {
        return { kind, title: 'Could not reach the mail server', summary: 'Check the SMTP host and port. For Gmail use smtp.gmail.com, port 587, TLS.' };
    }
    if (kind === 'tls') {
        return { kind, title: 'Encryption does not match the port', summary: 'Use TLS with port 587, or SSL with port 465.' };
    }
    return { kind, title: 'The email could not be sent', summary: 'The mail server gave the reason below.' };
}
