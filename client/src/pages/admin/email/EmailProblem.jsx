import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '../../../components/admin/ui';
import { GMAIL_APP_PASSWORDS_URL, GMAIL_TWO_STEP_URL, explainEmailError } from './emailProblems';

/**
 * A mail problem, said plainly, with the fix. For a Gmail password the
 * fix is the app password, step by step, with links to Google's pages.
 * message: the server's error text. context: where it happened ("Order
 * emails are failing", "Connection test"). onFix: focuses the password box.
 */
export default function EmailProblem({ message, context, config, onFix, extra }) {
    const problem = explainEmailError(message, config);
    return (
        <section className="em-problem" role="alert" aria-labelledby="em-problem-title">
            <div className="em-problem-head">
                <span className="em-problem-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
                <div>
                    {context && <p className="em-problem-context">{context}</p>}
                    <h2 className="em-problem-title" id="em-problem-title">{problem.title}</h2>
                    <p className="em-problem-summary">{problem.summary}</p>
                    <p className="em-problem-raw">Mail server said: <span className="ak-mono">{message}</span></p>
                    {extra}
                </div>
            </div>

            {problem.gmail && (
                <ol className="em-steps">
                    <li>
                        <strong>Turn on 2-Step Verification</strong> for {config?.email || 'the Gmail account'} (app passwords only
                        appear once it is on). <a className="ak-link" href={GMAIL_TWO_STEP_URL} target="_blank" rel="noreferrer">Open 2-Step Verification <ExternalLink size={12} aria-hidden="true" /></a>
                    </li>
                    <li>
                        <strong>Create an app password</strong>: sign in as {config?.email || 'that account'}, name it
                        &quot;DMS website&quot; and press Create. <a className="ak-link" href={GMAIL_APP_PASSWORDS_URL} target="_blank" rel="noreferrer">Open App passwords <ExternalLink size={12} aria-hidden="true" /></a>
                    </li>
                    <li><strong>Copy the 16-letter code</strong> Google shows (for example <span className="ak-mono">abcd efgh ijkl mnop</span>; the spaces do not matter).</li>
                    <li><strong>Paste it into Password below</strong>, press Save, then Test connection.</li>
                </ol>
            )}
            {problem.gmail && (
                <p className="ak-hint em-problem-note">
                    A Google Workspace account may need its admin to allow 2-Step Verification. Changing the Gmail password
                    later cancels every app password, so make a new one then.
                </p>
            )}
            {onFix && (problem.kind === 'auth' || problem.kind === 'not-configured') && (
                <Button size="sm" variant="dark" onClick={onFix}>Enter the new password</Button>
            )}
        </section>
    );
}
