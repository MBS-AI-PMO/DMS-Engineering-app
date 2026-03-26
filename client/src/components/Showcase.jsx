import React from 'react';
import { motion } from 'framer-motion';

const Showcase = ({ images, title = "MATERIAL SHOWCASE" }) => {
    if (!images || images.length === 0) return null;

    return (
        <div className="thickness-showcase">
            <h3 className="showcase-title-small">{title}</h3>
            <div className="showcase-grid">
                {images.map((img, idx) => (
                    <motion.div
                        key={idx}
                        className="showcase-item"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: idx * 0.15, ease: "easeOut" }}
                        whileHover={{
                            y: -8,
                            scale: 1.02,
                            transition: { duration: 0.3 }
                        }}
                    >
                        <div className="showcase-img-wrapper">
                            <img src={img} alt={`${title} ${idx + 1}`} className="showcase-img" />
                            <div className="showcase-overlay"></div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default Showcase;
