import React, { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * The right-hand configure drawer every service on the quote's Services step
 * opens in (tapping, countersinking, finish colour). It slides in over the
 * right of the quote panel and leaves the 3D model in view, so each choice
 * shows on the part as it is made. Light by design: no backdrop or blur.
 *
 * Escape and the close button call onClose; focus moves to the close button
 * on open and back to whatever opened the drawer when it goes away.
 */

const MotionAside = motion.aside;

export default function ConfigDrawer({
  title,
  meta = null,
  blurb = null,
  bodyRef = null,
  footer = null,
  onClose,
  children,
}) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const closeRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slide = reduceMotion
    ? { duration: 0 }
    : { type: 'tween', duration: 0.38, ease: [0.22, 1, 0.36, 1] };

  return (
    <MotionAside
      className="ipw-hd"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      initial={{ x: '100%', opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.6 }}
      transition={slide}
    >
      <header className="ipw-hd-head">
        <div className="ipw-hd-head-top">
          <span className="ipw-hd-eyebrow">Configure</span>
          <button
            ref={closeRef}
            type="button"
            className="ipw-modal-close"
            aria-label={`Close ${String(title || '').toLowerCase()}`}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <h3 id={titleId} className="ipw-hd-title">{title}</h3>
        {meta && <p className="ipw-hd-meta">{meta}</p>}
        {blurb && <p className="ipw-hd-blurb">{blurb}</p>}
      </header>

      <div className="ipw-hd-body" ref={bodyRef}>
        {children}
      </div>

      {/* A div, not <footer>: quote mode hides every footer element (index.css). */}
      {footer && <div className="ipw-hd-foot">{footer}</div>}
    </MotionAside>
  );
}
