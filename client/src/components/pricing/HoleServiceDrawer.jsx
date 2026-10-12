import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import ConfigDrawer from './ConfigDrawer';
import {
  HARDWARE_TYPES,
  countersinkGeometry,
  countersinkLabel,
  hardwareHoleTargetMm,
  hardwareSpecText,
  holeChangeTo,
  holeDiameterMm,
  optionBlockedReason,
  optionPrice,
  tapHoleTargetMm,
  tapThreadSpec,
} from '../../utils/holeFeatures';

/**
 * The right-hand drawer that configures Tapping, Countersinking or Hardware,
 * one row per hole size (open a row to set holes one by one), so the 3D
 * model stays in view and shows every change. Choices are stored per hole id
 * exactly as before: { ...adminOption, hole } for taps, plus `face` for
 * countersinks, and { item, hole, typeId, face } for hardware.
 */

const COPY = {
  tap: {
    title: 'Tapping',
    noun: ['tap', 'taps'],
    blurb: 'Pick a thread for each hole. Any thread fits any hole: we re-cut the hole to the size the thread needs.',
    column: 'Thread',
    none: 'No tap',
  },
  cs: {
    title: 'Countersinking',
    noun: ['countersink', 'countersinks'],
    blurb: 'Pick a countersink and the side it goes on. The hole is re-cut to the countersink’s through-hole size.',
    column: 'Countersink',
    none: 'No countersink',
    side: 'Countersink on the',
    pickFirst: 'Choose a countersink first',
  },
  hw: {
    title: 'Hardware',
    noun: ['part', 'parts'],
    blurb: 'Pick a stud, standoff or nut for each hole, and the side it faces. Any part fits any hole: we re-cut the hole to the size the part needs.',
    column: 'Hardware',
    none: 'No hardware',
    side: 'Part on the',
    pickFirst: 'Choose a part first',
  },
};

// Taps and countersinks are admin sizes known by name; a hardware part is a
// row of the admin's hardware list, known by its id.
const optionKey = (kind, option) => (kind === 'hw' ? `hw-${option?.id}` : option?.name);
const selectionKey = (kind, sel) => {
  if (!sel) return null;
  if (kind === 'hw') return sel.item ? `hw-${sel.item.id}` : null;
  return sel.name ?? null;
};
const optionTitle = (kind, option) => (kind === 'cs' ? countersinkLabel(option) : option?.name);

const FACES = [
  { key: 'up', text: 'Top', icon: ArrowUp },
  { key: 'down', text: 'Bottom', icon: ArrowDown },
];

const fmtMm = (mm) => `${mm.toFixed(mm < 10 ? 2 : 1)} mm`;
const fmtIn = (mm) => `${(mm / 25.4).toFixed(3)}"`;
const fmtSize = (mm, unit) => (unit === 'inch' ? fmtIn(mm) : fmtMm(mm));
const fmtMoney = (n) => `$${n.toFixed(2)}`;

function changeText(kind, option, hole, unit) {
  if (!option || !hole) return null;
  const target = kind === 'tap'
    ? tapHoleTargetMm(option, hole)
    : kind === 'cs'
      ? countersinkGeometry(option).minorMm
      : hardwareHoleTargetMm(option.hardware_type_id, option);
  if (!(target > 0)) return null;
  const change = holeChangeTo(hole, target);
  if (change === 'none') return null;
  return change === 'fill'
    ? `Hole filled and re-cut to ${fmtSize(target, unit)}`
    : `Hole cut bigger to ${fmtSize(target, unit)}`;
}

/**
 * The size picker: a button and a keyboard-friendly list (two columns for
 * threads; hardware listed by kind, one under another).
 */
function OptionMenu({ kind, options, value, onSelect, blockedReason, unit, sampleHole, label }) {
  const [open, setOpen] = useState(false);
  const [placeUp, setPlaceUp] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const columns = useMemo(() => {
    if (kind === 'hw') {
      return HARDWARE_TYPES
        .map(type => ({ title: type.label, items: options.filter(o => Number(o.hardware_type_id) === type.id) }))
        .filter(col => col.items.length > 0);
    }
    if (kind !== 'tap') return [{ title: 'Major / Minor / Angle', items: options }];
    const metric = options.filter(o => tapThreadSpec(o).system === 'metric');
    const imperial = options.filter(o => tapThreadSpec(o).system !== 'metric');
    return [
      { title: 'Metric', items: metric },
      { title: 'Imperial', items: imperial },
    ].filter(col => col.items.length > 0);
  }, [kind, options]);

  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const current = listRef.current?.querySelector('[aria-selected="true"]')
      || listRef.current?.querySelector('[role="option"]:not([aria-disabled="true"])');
    current?.focus({ preventScroll: true });
  }, [open]);

  // Opens upward when the scrolling drawer body has no room left below.
  const openMenu = () => {
    const wrap = wrapRef.current;
    if (wrap) {
      const scroller = wrap.closest('.ipw-hd-body');
      const box = wrap.getBoundingClientRect();
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      setPlaceUp(bottom - box.bottom < 300 && box.top - top > bottom - box.bottom);
    }
    setOpen(true);
  };

  const onListKey = (e) => {
    const items = Array.from(listRef.current?.querySelectorAll('[role="option"]:not([aria-disabled="true"])') || []);
    const index = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
      items[next]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const choose = (option) => {
    onSelect(option);
    close(true);
  };

  const shown = value === 'mixed'
    ? 'Mixed'
    : value
      ? optionTitle(kind, value)
      : 'Select';
  const valueKey = value && value !== 'mixed' ? optionKey(kind, value) : null;
  const listClass = kind === 'hw' ? ' is-wide' : (columns.length > 1 ? ' is-split' : '');

  return (
    <div className="ipw-hd-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`ipw-hd-select${value && value !== 'mixed' ? ' is-set' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${shown}`}
        title={value && value !== 'mixed' ? shown : undefined}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); openMenu(); }
        }}
      >
        <span className="ipw-hd-select-text">{shown}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className={`ipw-hd-list${placeUp ? ' is-up' : ''}${listClass}`}
          onKeyDown={onListKey}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className="ipw-hd-option is-none"
            onClick={() => choose(null)}
          >
            {(COPY[kind] || COPY.tap).none}
          </button>
          <div className="ipw-hd-cols">
            {columns.map(col => (
              <div key={col.title} role="group" aria-label={col.title} className="ipw-hd-col">
                <span className="ipw-hd-col-title" aria-hidden="true">{col.title}</span>
                {col.items.map(option => {
                  const blocked = blockedReason(option, sampleHole);
                  const selected = valueKey !== null && valueKey === optionKey(kind, option);
                  const hint = !blocked ? changeText(kind, option, sampleHole, unit) : null;
                  const sub = kind === 'cs' ? option.name : kind === 'hw' ? (hint || hardwareSpecText(option)) : hint;
                  return (
                    <button
                      key={optionKey(kind, option)}
                      type="button"
                      role="option"
                      aria-selected={Boolean(selected)}
                      aria-disabled={blocked ? 'true' : undefined}
                      title={blocked || hint || undefined}
                      className={`ipw-hd-option${selected ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}`}
                      onClick={() => { if (!blocked) choose(option); }}
                    >
                      <span className="ipw-hd-option-main">
                        <span className="ipw-hd-option-name">{optionTitle(kind, option)}</span>
                        <span className="ipw-hd-option-sub">{blocked || sub || ' '}</span>
                      </span>
                      <span className="ipw-hd-option-price">{fmtMoney(optionPrice(option))}</span>
                      {selected && <Check size={13} strokeWidth={3} className="ipw-hd-option-check" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A hole that already carries another feature, with an x to take it off. */
function TakenBy({ lock, onRemove, showDetail = true }) {
  if (!lock) return null;
  const what = String(lock.label || '').toLowerCase();
  return (
    <span className="ipw-hd-taken">
      <span className="ipw-hd-taken-text">
        <span>{lock.label}</span>
        {showDetail && lock.detail ? <small>{lock.detail}</small> : null}
      </span>
      {onRemove && (
        <button
          type="button"
          className="ipw-hd-taken-x"
          aria-label={`Remove ${what} from this hole`}
          title={`Remove ${what}`}
          onClick={onRemove}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Top / Bottom: which face the countersink is cut from, or the part faces. */
function FaceSwitch({ kind, face, disabled, onChange, label }) {
  const copy = COPY[kind] || COPY.cs;
  return (
    <div className="ipw-hd-face" role="group" aria-label={`${label} side`}>
      {FACES.map((item) => {
        const FaceIcon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            className={face === item.key ? 'is-on' : ''}
            aria-pressed={face === item.key}
            disabled={disabled}
            title={disabled ? copy.pickFirst : `${copy.side} ${item.text.toLowerCase()} side`}
            onClick={() => onChange(item.key)}
          >
            <FaceIcon size={13} aria-hidden="true" />
            <span className="ipw-sr">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function HoleServiceDrawer({
  kind,
  holes,
  holeNumberById,
  options,
  selections,
  onSelectionsChange,
  sheetThicknessMm,
  unit,
  onClose,
  onHoverHoles,
  pickedHole,
  isFindingHoles = false,
  isLoadingOptions = false,
  // One feature per hole: holes that already carry another one (a tap, a
  // countersink, hardware) map to { kind, label, detail } and cannot be
  // picked here until that feature is taken off with the row's x.
  lockedHoles = {},
  onUnlockHoles = null,
}) {
  const reduceMotion = useReducedMotion();
  const copy = COPY[kind] || COPY.tap;
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(() => new Set());
  // Groups whose open animation has finished; only these let a size list
  // hang outside the row (see .is-settled in the stylesheet).
  const [settled, setSettled] = useState(() => new Set());
  const [seenPickSeq, setSeenPickSeq] = useState(pickedHole?.seq ?? 0);
  // Hardware: one tab per kind (studs, standoffs, nuts, flush nuts); the
  // size lists show the open tab's parts. Opens on the kind already in use.
  const [hwType, setHwType] = useState(() => {
    const chosen = Object.values(selections || {}).find(sel => sel?.typeId);
    return chosen ? Number(chosen.typeId) : null;
  });

  useEffect(() => () => onHoverHoles(null), [onHoverHoles]);

  const typeTabs = kind === 'hw'
    ? HARDWARE_TYPES.filter(type => (options || []).some(o => Number(o.hardware_type_id) === type.id))
    : [];
  const activeType = typeTabs.some(type => type.id === hwType) ? hwType : (typeTabs[0]?.id ?? null);
  const menuOptions = kind === 'hw' && activeType !== null
    ? options.filter(o => Number(o.hardware_type_id) === activeType)
    : options;

  const groups = useMemo(() => {
    const byKey = new Map();
    (holes || []).forEach(hole => {
      const dia = holeDiameterMm(hole);
      const key = (Math.round(dia * 20) / 20).toFixed(2);
      if (!byKey.has(key)) byKey.set(key, { key, diaMm: dia, holes: [] });
      byKey.get(key).holes.push(hole);
    });
    return Array.from(byKey.values()).sort((a, b) => a.diaMm - b.diaMm);
  }, [holes]);

  const optionByKey = useMemo(() => {
    const map = new Map();
    (options || []).forEach(o => map.set(optionKey(kind, o), o));
    return map;
  }, [kind, options]);

  // The admin's current row for a hole's choice (the stored copy if that
  // row is gone), in the shape the size list uses.
  const optionFor = useCallback((sel) => {
    if (!sel) return null;
    return optionByKey.get(selectionKey(kind, sel)) || (kind === 'hw' ? sel.item || null : sel);
  }, [kind, optionByKey]);

  const blockedReason = useCallback(
    (option, hole) => optionBlockedReason(kind, option, sheetThicknessMm, hole),
    [kind, sheetThicknessMm]
  );

  // A hole picked on the 3D model opens its size row (adjusting state when a
  // prop changes, as React recommends) and is then scrolled into view.
  const pickedId = pickedHole && pickedHole.id !== null && pickedHole.id !== undefined
    ? String(pickedHole.id)
    : null;
  if ((pickedHole?.seq ?? 0) !== seenPickSeq) {
    setSeenPickSeq(pickedHole?.seq ?? 0);
    const group = pickedId ? groups.find(g => g.holes.some(h => String(h.id) === pickedId)) : null;
    if (group && !expanded.has(group.key)) setExpanded(new Set(expanded).add(group.key));
  }
  useEffect(() => {
    if (!pickedId) return undefined;
    const frame = requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector(`[data-hole-row="${CSS.escape(pickedId)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pickedId, pickedHole?.seq, reduceMotion]);

  const isLocked = useCallback((hole) => Boolean(lockedHoles?.[hole.id]), [lockedHoles]);

  const setFor = useCallback((holeList, option) => {
    onSelectionsChange(prev => {
      const next = { ...(prev || {}) };
      holeList.forEach(hole => {
        if (isLocked(hole)) return;
        if (!option) {
          delete next[hole.id];
        } else if (optionBlockedReason(kind, option, sheetThicknessMm, hole)) {
          // A size this hole cannot take (a group can mix such holes).
        } else if (kind === 'hw') {
          next[hole.id] = {
            item: option,
            hole,
            typeId: Number(option.hardware_type_id),
            face: prev?.[hole.id]?.face || 'up',
          };
        } else if (kind === 'cs') {
          next[hole.id] = { ...option, hole, face: prev?.[hole.id]?.face || 'up' };
        } else {
          next[hole.id] = { ...option, hole };
        }
      });
      return next;
    });
  }, [kind, onSelectionsChange, isLocked, sheetThicknessMm]);

  const setFaceFor = useCallback((holeList, face) => {
    onSelectionsChange(prev => {
      const next = { ...(prev || {}) };
      holeList.forEach(hole => {
        if (next[hole.id]) next[hole.id] = { ...next[hole.id], face };
      });
      return next;
    });
  }, [onSelectionsChange]);

  const valueFor = (holeList) => {
    const keys = holeList.map(h => selectionKey(kind, selections?.[h.id]));
    if (keys.every(k => k === null)) return null;
    if (keys.every(k => k === keys[0])) return optionFor(selections[holeList[0].id]);
    return 'mixed';
  };

  const faceFor = (holeList) => {
    const faces = holeList.map(h => selections?.[h.id]?.face).filter(Boolean);
    if (faces.length === 0) return null;
    return faces.every(f => f === faces[0]) ? faces[0] : null;
  };

  const chosenCount = (holes || []).filter(h => selections?.[h.id]).length;
  const perPart = (holes || []).reduce((sum, h) => {
    const sel = selections?.[h.id];
    if (!sel) return sum;
    return sum + optionPrice(optionFor(sel));
  }, 0);
  const noun = copy.noun[chosenCount === 1 ? 0 : 1];

  const toggleGroup = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSettled(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const hoverProps = (ids) => ({
    onMouseEnter: () => onHoverHoles(ids),
    onMouseLeave: () => onHoverHoles(null),
    onFocus: () => onHoverHoles(ids),
    onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) onHoverHoles(null); },
  });

  return (
    <ConfigDrawer
      title={copy.title}
      meta={(
        <>
          <strong>{chosenCount}</strong> {noun} on {holes.length} hole{holes.length === 1 ? '' : 's'}
          {perPart > 0 && <span> · +{fmtMoney(perPart)} per part</span>}
        </>
      )}
      blurb={copy.blurb}
      bodyRef={bodyRef}
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            className="ipw-link-btn"
            disabled={chosenCount === 0}
            onClick={() => onSelectionsChange({})}
          >
            Reset all
          </button>
          <button type="button" className="ipw-btn ipw-btn-dark ipw-hd-done" onClick={onClose}>
            Done
          </button>
        </>
      )}
    >
      {groups.length === 0 ? (
        <p className="ipw-hd-empty" role="status">
          {isFindingHoles ? 'Still finding the holes on this part…' : 'No round holes were found on this part.'}
        </p>
      ) : options.length === 0 ? (
        <p className="ipw-hd-empty" role="status">
          {isLoadingOptions
            ? `Loading the ${copy.noun[1]}…`
            : `No ${copy.noun[1]} are set up yet. Add ${kind === 'hw' ? 'them' : 'sizes'} in the admin dashboard.`}
        </p>
      ) : (
        <>
          {typeTabs.length > 0 && (
            <div className="ipw-hd-tabbar">
              <div className="ipw-seg ipw-hd-tabs" role="group" aria-label="Hardware type">
                {typeTabs.map(type => {
                  const count = (holes || []).filter(h => Number(selections?.[h.id]?.typeId) === type.id).length;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={activeType === type.id ? 'active' : ''}
                      aria-pressed={activeType === type.id}
                      onClick={() => setHwType(type.id)}
                    >
                      <span className="ipw-hd-tab-text">{type.label}</span>
                      {count > 0 && (
                        <span className="ipw-hd-tab-count" aria-label={`${count} hole${count === 1 ? '' : 's'}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={`ipw-hd-colheads${kind === 'tap' ? '' : ' has-face'}`} aria-hidden="true">
            <span>Hole size</span>
            <span>{copy.column}</span>
          </div>
          <ul className="ipw-hd-groups">
            {groups.map(group => {
              const isOpen = expanded.has(group.key);
              const isSettled = isOpen && (reduceMotion || settled.has(group.key));
              const ids = group.holes.map(h => h.id);
              const freeHoles = group.holes.filter(h => !isLocked(h));
              const groupValue = freeHoles.length ? valueFor(freeHoles) : null;
              const groupLabel = `Holes ${fmtSize(group.diaMm, unit)}`;
              const hint = groupValue && groupValue !== 'mixed'
                ? changeText(kind, groupValue, group.holes[0], unit)
                : null;
              return (
                <li key={group.key} className={`ipw-hd-group${isOpen ? ' is-open' : ''}${isSettled ? ' is-settled' : ''}`}>
                  <div className={`ipw-hd-row is-group${groupValue ? ' is-set' : ''}`} {...hoverProps(ids)}>
                    <button
                      type="button"
                      className="ipw-hd-toggle"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} each ${fmtSize(group.diaMm, unit)} hole`}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                    <span className="ipw-hd-size">
                      <span className="ipw-hd-size-main">Ø {fmtSize(group.diaMm, unit)}</span>
                      <span className="ipw-hd-size-sub">
                        {group.holes.length} hole{group.holes.length === 1 ? '' : 's'}
                        {unit === 'inch' ? ` · ${fmtMm(group.diaMm)}` : ` · ${fmtIn(group.diaMm)}`}
                      </span>
                    </span>
                    {freeHoles.length ? (
                      <OptionMenu
                        kind={kind}
                        options={menuOptions}
                        value={groupValue}
                        onSelect={(option) => setFor(freeHoles, option)}
                        blockedReason={blockedReason}
                        unit={unit}
                        sampleHole={freeHoles[0]}
                        label={`${copy.column} for all ${groupLabel.toLowerCase()}`}
                      />
                    ) : (
                      <TakenBy
                        lock={lockedHoles[group.holes[0].id]}
                        showDetail={false}
                        onRemove={onUnlockHoles ? () => {
                          const kindToClear = lockedHoles[group.holes[0].id].kind;
                          onUnlockHoles(
                            group.holes.filter(h => lockedHoles[h.id]?.kind === kindToClear).map(h => h.id),
                            kindToClear
                          );
                        } : null}
                      />
                    )}
                    {(kind === 'cs' || kind === 'hw') && (
                      <FaceSwitch
                        kind={kind}
                        face={faceFor(freeHoles)}
                        disabled={!groupValue}
                        onChange={(face) => setFaceFor(freeHoles, face)}
                        label={groupLabel}
                      />
                    )}
                  </div>
                  {hint && <p className="ipw-hd-hint">{hint}</p>}
                  <div
                    className="ipw-hd-holes"
                    inert={!isOpen}
                    onTransitionEnd={(e) => {
                      if (e.target !== e.currentTarget || !isOpen) return;
                      setSettled(prev => (prev.has(group.key) ? prev : new Set(prev).add(group.key)));
                    }}
                  >
                    <div className="ipw-hd-holes-inner">
                      {group.holes.map(hole => {
                        const value = optionFor(selections?.[hole.id]);
                        const number = holeNumberById?.[hole.id] ?? '';
                        return (
                          <div
                            key={pickedId === String(hole.id) ? `${hole.id}-${pickedHole.seq}` : hole.id}
                            data-hole-row={String(hole.id)}
                            className={`ipw-hd-row is-hole${value ? ' is-set' : ''}${pickedId === String(hole.id) ? ' is-flash' : ''}`}
                            {...hoverProps([hole.id])}
                          >
                            <span className="ipw-hd-hole-num" aria-hidden="true">{number}</span>
                            <span className="ipw-hd-size">
                              <span className="ipw-hd-size-main">Hole {number}</span>
                            </span>
                            {isLocked(hole) ? (
                              <TakenBy
                                lock={lockedHoles[hole.id]}
                                onRemove={onUnlockHoles ? () => onUnlockHoles([hole.id], lockedHoles[hole.id].kind) : null}
                              />
                            ) : (
                              <OptionMenu
                                kind={kind}
                                options={menuOptions}
                                value={value}
                                onSelect={(option) => setFor([hole], option)}
                                blockedReason={blockedReason}
                                unit={unit}
                                sampleHole={hole}
                                label={`${copy.column} for hole ${number}`}
                              />
                            )}
                            {(kind === 'cs' || kind === 'hw') && (
                              <FaceSwitch
                                kind={kind}
                                face={value ? (selections[hole.id].face || 'up') : null}
                                disabled={!value}
                                onChange={(face) => setFaceFor([hole], face)}
                                label={`Hole ${number}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ConfigDrawer>
  );
}
