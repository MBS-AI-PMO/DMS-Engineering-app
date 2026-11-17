import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, Input } from '../../../components/admin/ui';
import './people.css';

/**
 * A password Input with a show/hide button inside it. Takes every Input
 * prop; put it inside a Field so the label points at the input.
 */
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
    const [shown, setShown] = useState(false);
    return (
        <span className="pp-password">
            <Input ref={ref} {...props} type={shown ? 'text' : 'password'} />
            <IconButton
                icon={shown ? EyeOff : Eye}
                label="Show password"
                size="xs"
                aria-pressed={shown}
                onClick={() => setShown(s => !s)}
            />
        </span>
    );
});
