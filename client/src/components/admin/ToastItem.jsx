import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const icons = {
    success: <CheckCircle className="toast-icon-svg" size={20} />,
    error: <XCircle className="toast-icon-svg" size={20} />,
    warning: <AlertTriangle className="toast-icon-svg" size={20} />,
    info: <Info className="toast-icon-svg" size={20} />,
};

export default function ToastItem({ toast, onDismiss }) {
    const [progress, setProgress] = useState(100);
    const duration = 4000; // Match the timeout in ToastContext

    useEffect(() => {
        const interval = 10;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [duration]);

    return (
        <motion.div
            layout
            className={`admin-toast-item toast-${toast.type}`}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9, transition: { duration: 0.2 } }}
            whileHover={{ scale: 1.02 }}
        >
            <div className="toast-content">
                <span className={`toast-icon-wrapper icon-${toast.type}`}>
                    {icons[toast.type] || icons.info}
                </span>
                <div className="toast-text-container">
                    <span className="toast-message">{toast.message}</span>
                </div>
                <button className="toast-close-btn" onClick={() => onDismiss(toast.id)}>
                    <X size={16} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="toast-progress-container">
                <motion.div
                    className="toast-progress-bar"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "linear" }}
                />
            </div>
        </motion.div>
    );
}
