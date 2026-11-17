import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, Input } from '../../../components/admin/ui';
import './SecretInput.css';

/**
 * A password / secret box with a show-hide button. Takes Input's props.
 * Candidate for the admin kit.
 */
const SecretInput = forwardRef(function SecretInput({ className, ...props }, ref) {
    const [shown, setShown] = useState(false);
    return (
        <span className={`pm-secret${className ? ` ${className}` : ''}`}>
            <Input ref={ref} type={shown ? 'text' : 'password'} autoComplete="off" spellCheck={false} {...props} />
            <IconButton
                icon={shown ? EyeOff : Eye}
                label={shown ? 'Hide' : 'Show'}
                size="xs"
                onClick={() => setShown(s => !s)}
                disabled={props.disabled}
            />
        </span>
    );
});

export default SecretInput;
