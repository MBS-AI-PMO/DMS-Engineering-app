import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const typeMeta = {
    success: {
        icon: <CheckCircle className="toast-icon-svg" size={18} />,
        label: 'Success',
    },
    error: {
        icon: <XCircle className="toast-icon-svg" size={18} />,
        label: 'Error',
    },
    warning: {
        icon: <AlertTriangle className="toast-icon-svg" size={18} />,
        label: 'Warning',
    },
    info: {
        icon: <Info className="toast-icon-svg" size={18} />,
        label: 'Info',
    },
};

export default function ToastItem({ toast, onDismiss }) {
    const [progress, setProgress] = useState(100);
    const duration = 4000;

    useEffect(() => {
        const interval = 10;
        const step = (interval / duration) * 100;
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev <= 0) { clearInterval(timer); return 0; }
                return prev - step;
            });
        }, interval);
        return () => clearInterval(timer);
    }, []);

    // Support both plain string and { title, message } object
    const isObjectMessage = typeof toast.message === 'object' && toast.message !== null;
    const title = isObjectMessage ? toast.message.title : null;
    const body = isObjectMessage ? toast.message.message : toast.message;
    const meta = typeMeta[toast.type] || typeMeta.info;
    const hasCustomTitle = typeof title === 'string' && title.trim().length > 0;
    const primaryText = hasCustomTitle
        ? title.trim()
        : (typeof body === 'string' ? body : String(body || ''));
    const secondaryText = hasCustomTitle
        ? (typeof body === 'string' ? body : String(body || ''))
        : '';

    return (
        <motion.div
            layout
            className={`admin-toast-item toast-${toast.type}`}
            initial={{ opacity: 0, y: 10, x: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, x: 16, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            whileHover={{ scale: 1.01 }}
            role="status"
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
            <div className="toast-content">
                <span className={`toast-icon-wrapper icon-${toast.type}`}>
                    {meta.icon}
                </span>

                <div className="toast-text-container">
                    <div className="toast-head-row">
                        <div className="toast-head-main">
                            <span className="toast-title">{primaryText}</span>
                            {hasCustomTitle && <span className={`toast-type-pill pill-${toast.type}`}>{meta.label}</span>}
                        </div>
                        <button className="toast-close-btn" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
                            <X size={15} />
                        </button>
                    </div>

                    {secondaryText ? <span className="toast-message">{secondaryText}</span> : null}
                </div>
            </div>

            <div className="toast-progress-track">
                <motion.div
                    className="toast-progress-bar"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: 'linear' }}
                />
            </div>
        </motion.div>
    );
}
