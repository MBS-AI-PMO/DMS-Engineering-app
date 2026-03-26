import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const ImageModal = ({ src, alt, onClose }) => {
    if (!src) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="image-zoom-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <div className="image-zoom-container">
                    <motion.div
                        className="image-zoom-content"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="image-zoom-close" onClick={onClose}>
                            <X size={24} />
                        </button>
                        <img src={src} alt={alt || 'Enlarged view'} className="image-zoom-img" />
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ImageModal;
