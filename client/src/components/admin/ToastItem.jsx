import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const icons = {
    success: <CheckCircle className="toast-icon-svg" size={18} />,
    error:   <XCircle     className="toast-icon-svg" size={18} />,
    warning: <AlertTriangle className="toast-icon-svg" size={18} />,
    info:    <Info        className="toast-icon-svg" size={18} />,
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
    const title = typeof toast.message === 'object' ? toast.message.title : null;
    const body  = typeof toast.message === 'object' ? toast.message.message : toast.message;

    return (
        <motion.div
            layout
            className={`admin-toast-item toast-${toast.type}`}
            initial={{ opacity: 0, x: 60, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.92, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            whileHover={{ scale: 1.015 }}
        >
            <div className="toast-content">
                <span className={`toast-icon-wrapper icon-${toast.type}`}>
                    {icons[toast.type] || icons.info}
                </span>
                <div className="toast-text-container">
                    {title
                        ? <>
                            <span className="toast-title">{title}</span>
                            <span className="toast-message">{body}</span>
                          </>
                        : <span className="toast-message-only">{body}</span>
                    }
                </div>
                <button className="toast-close-btn" onClick={() => onDismiss(toast.id)}>
                    <X size={15} />
                </button>
            </div>

            <div className="toast-progress-container">
                <motion.div
                    className="toast-progress-bar"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: 'linear' }}
                />
            </div>
        </motion.div>
    );
}
