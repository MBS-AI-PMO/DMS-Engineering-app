import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import ConfigDrawer from './ConfigDrawer';
import { wrinkleSwatchStyle } from '../../utils/wrinkleTexture';

/**
 * The right-hand drawer that picks the color for a finish service (Powder
 * Coating, Anodizing). Pointing at a color shows it on the 3D model; a click
 * chooses it and the drawer stays open so colors can be compared. The choice
 * is stored exactly as the old pop-up stored it: { ...adminOption, index }.
 */

const isPowderCoat = (svc) => String(svc?.title || '').toLowerCase().includes('powder coat');

function finishDetail(option, isPowder) {
  const parts = [String(option.color || '').toUpperCase()];
  const gloss = Number(option.gloss);
  if (isPowder && Number.isFinite(gloss) && option.gloss !== null && option.gloss !== '') {
    parts.push(`Gloss ${Math.round(gloss)}`);
  }
  return parts.filter(Boolean).join(' · ');
}

export default function FinishColorDrawer({ svc, selected, onSelect, onSkip, onPreview, onClose }) {
  const listRef = useRef(null);
  const isPowder = isPowderCoat(svc);
  const processName = isPowder ? 'powder coating' : 'anodizing';
  const options = Array.isArray(svc?.service_options) ? svc.service_options : [];
  const selectedIndex = selected ? options.findIndex(o => o.name === selected.name) : -1;
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => () => onPreview(null), [onPreview]);

  const onListKey = (e) => {
    const items = Array.from(listRef.current?.querySelectorAll('[role="option"]') || []);
    const index = items.indexOf(document.activeElement);
    if (index < 0) return;
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(items.length - 1, index + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <ConfigDrawer
      title={svc?.title || 'Finish color'}
      meta={selected
        ? <><span className="ipw-fc-chosen">{selected.name || selected.color}</span> chosen</>
        : 'No color chosen yet'}
      blurb={`The part is ${isPowder ? 'powder coated' : 'anodized'} in the color you pick. Point at a color to see it on the model.`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="ipw-link-btn" onClick={onSkip}>
            Skip {processName}
          </button>
          <button type="button" className="ipw-btn ipw-btn-dark ipw-hd-done" onClick={onClose}>
            Done
          </button>
        </>
      )}
    >
      {options.length === 0 ? (
        <p className="ipw-hd-empty">No colors are set up for {processName} yet. Add them in the admin dashboard.</p>
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-label={`${svc?.title || 'Finish'} colors`}
          className="ipw-fc-grid"
          onKeyDown={onListKey}
          onMouseLeave={() => onPreview(null)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onPreview(null); }}
        >
          {options.map((option, i) => {
            const isOn = i === selectedIndex;
            return (
              <button
                key={`${option.name}-${i}`}
                type="button"
                role="option"
                aria-selected={isOn}
                tabIndex={i === focusIndex ? 0 : -1}
                className={`ipw-fc-tile${isOn ? ' is-selected' : ''}`}
                onMouseEnter={() => onPreview(option)}
                onFocus={() => onPreview(option)}
                onClick={() => onSelect(option, i)}
              >
                <span
                  className="ipw-fc-swatch"
                  aria-hidden="true"
                  style={wrinkleSwatchStyle(option.color, !!option.is_wrinkled, 8)}
                />
                <span className="ipw-fc-text">
                  <span className="ipw-fc-name">{option.name || option.color}</span>
                  <span className="ipw-fc-sub">{finishDetail(option, isPowder)}</span>
                  {option.is_wrinkled && <span className="ipw-fc-tag">Wrinkle</span>}
                </span>
                {isOn && <Check size={14} strokeWidth={3} className="ipw-fc-check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </ConfigDrawer>
  );
}
