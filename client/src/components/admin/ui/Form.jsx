import { Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * A labelled form control. Wrap one Input / Select / Textarea / custom
 * control: <Field label="Name" hint="Shown to customers"><Input … /></Field>
 * optional: shows "optional" after the label. error: red text under it.
 */
export function Field({ label, hint, optional = false, error, children, className, as = 'label' }) {
    const Tag = as;
    return (
        <Tag className={cx('ak-field', className)}>
            {label && (Tag === 'fieldset'
                ? <legend>{label}{optional && <em>optional</em>}</legend>
                : <span>{label}{optional && <em>optional</em>}</span>)}
            {children}
            {hint && !error && <p className="ak-hint">{hint}</p>}
            {error && <p className="ak-error-text" role="alert">{error}</p>}
        </Tag>
    );
}

/** Two (or three) fields side by side, stacked on phones. */
export function FieldRow({ children, columns = 2 }) {
    return <div className={cx('ak-field-row', columns === 3 && 'is-3')}>{children}</div>;
}

export const Input = forwardRef(function Input({ size, invalid, className, ...props }, ref) {
    return <input ref={ref} className={cx('ak-input', size === 'sm' && 'is-sm', invalid && 'is-invalid', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ invalid, className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cx('ak-input', invalid && 'is-invalid', className)} {...props} />;
});

const textOf = (node) => (typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(textOf).join('') : isValidElement(node) ? textOf(node.props.children) : '');

/* The choices, from `options` and/or <option>/<optgroup> children. Values are
 * strings, as a native <select> gives them. */
function readOptions(options, children, placeholder) {
    const list = [];
    if (placeholder !== undefined) list.push({ value: '', label: placeholder, isPlaceholder: true });
    options.forEach(o => (o !== null && typeof o === 'object'
        ? list.push({ value: String(o.value), label: o.label ?? String(o.value), disabled: Boolean(o.disabled), group: o.group })
        : list.push({ value: String(o), label: String(o) })));
    const walk = (nodes, group) => Children.forEach(nodes, child => {
        if (!isValidElement(child)) return;
        if (child.type === 'optgroup') walk(child.props.children, child.props.label);
        else if (child.type === 'option') {
            list.push({ value: String(child.props.value ?? textOf(child.props.children)), label: child.props.children, disabled: Boolean(child.props.disabled), group });
        } else if (child.type === Fragment) walk(child.props.children, group);
    });
    walk(children);
    return list;
}

const LIST_MAX_HEIGHT = 300;

/**
 * A dropdown in the kit's style (not the browser's). Same use as a native
 * <select>: options [{ value, label, disabled?, group? }] or strings, and/or
 * <option>/<optgroup> children; value + onChange(e) with e.target.value (a
 * string); placeholder adds an empty first choice; size 'sm'; name adds a
 * hidden input for forms. Keyboard: arrows, Home/End, Enter/Space, Escape,
 * typing a letter jumps to it.
 */
export const Select = forwardRef(function Select(
    { options = [], placeholder, size, className, children, value, defaultValue, onChange, disabled, name, id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...rest },
    ref,
) {
    const items = useMemo(() => readOptions(options, children, placeholder), [options, children, placeholder]);
    const [inner, setInner] = useState(defaultValue ?? '');
    const current = String(value !== undefined && value !== null ? value : inner);
    const selectedIndex = items.findIndex(i => i.value === current);
    const selected = items[selectedIndex];
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [pos, setPos] = useState(null);
    const buttonRef = useRef(null);
    const listRef = useRef(null);
    const typed = useRef({ text: '', at: 0 });
    const listId = useId();

    const setButtonRef = (node) => {
        buttonRef.current = node;
        if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
    };

    const place = useCallback(() => {
        const r = buttonRef.current?.getBoundingClientRect();
        if (!r) return;
        const below = window.innerHeight - r.bottom;
        const wanted = Math.min(LIST_MAX_HEIGHT, items.length * 38 + 14);
        const up = below < wanted + 12 && r.top > below;
        setPos({ left: Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8), minWidth: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
    }, [items.length]);

    const openList = (at) => {
        if (disabled) return;
        place();
        setActive(at ?? (selectedIndex >= 0 ? selectedIndex : items.findIndex(i => !i.disabled)));
        setOpen(true);
    };
    const close = () => { setOpen(false); setActive(-1); };

    const choose = (index) => {
        const item = items[index];
        if (!item || item.disabled) return;
        if (value === undefined) setInner(item.value);
        if (item.value !== current) onChange?.({ target: { value: item.value, name }, currentTarget: { value: item.value, name }, type: 'change' });
        close();
        buttonRef.current?.focus();
    };

    const step = (from, dir) => {
        for (let i = 1; i <= items.length; i += 1) {
            const next = (from + dir * i + items.length * 2) % items.length;
            if (!items[next].disabled) return next;
        }
        return from;
    };

    const onKeyDown = (e) => {
        if (disabled) return;
        const key = e.key;
        if (!open) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) { e.preventDefault(); openList(); }
            return;
        }
        if (key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (key === 'Tab') { close(); return; }
        if (key === 'ArrowDown') { e.preventDefault(); setActive(a => step(a < 0 ? -1 : a, 1)); return; }
        if (key === 'ArrowUp') { e.preventDefault(); setActive(a => step(a < 0 ? items.length : a, -1)); return; }
        if (key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); return; }
        if (key === 'End') { e.preventDefault(); setActive(step(items.length, -1)); return; }
        if (key === 'Enter' || key === ' ') { e.preventDefault(); choose(active); return; }
        if (key.length === 1 && /\S/.test(key)) {
            const now = Date.now();
            typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + key.toLowerCase(), at: now };
            const match = items.findIndex(i => !i.disabled && textOf(i.label).toLowerCase().startsWith(typed.current.text));
            if (match >= 0) setActive(match);
        }
    };

    // Close on a click outside; follow the button while the page scrolls.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
            close();
        };
        const onMove = (e) => { if (!listRef.current?.contains(e.target)) place(); };
        document.addEventListener('mousedown', onDown);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', onMove, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [open, place]);

    useEffect(() => {
        if (open && active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [open, active]);

    const optionId = (i) => `${listId}-opt-${i}`;
    const showPlaceholder = !selected || selected.isPlaceholder;

    return (
        <>
            <button
                ref={setButtonRef}
                id={id}
                type="button"
                role="combobox"
                className={cx('ak-select', 'ak-select-trigger', size === 'sm' && 'is-sm', open && 'is-open', className)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                disabled={disabled}
                onClick={() => (open ? close() : openList())}
                onKeyDown={onKeyDown}
                {...rest}
            >
                <span className={cx('ak-select-value', showPlaceholder && 'is-placeholder')}>
                    {selected ? selected.label : (placeholder ?? 'Choose…')}
                </span>
                <ChevronDown size={16} className="ak-select-chevron" aria-hidden="true" />
            </button>
            {name && <input type="hidden" name={name} value={current} />}
            {open && pos && createPortal(
                <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="ak-listbox" style={pos}>
                    {items.map((item, i) => (
                        <Fragment key={`${item.group || ''}|${item.value}|${i}`}>
                            {item.group && item.group !== items[i - 1]?.group && <li role="presentation" className="ak-listbox-group">{item.group}</li>}
                            <li
                                id={optionId(i)}
                                role="option"
                                data-index={i}
                                aria-selected={item.value === current}
                                aria-disabled={item.disabled || undefined}
                                className={cx('ak-option', i === active && 'is-active', item.value === current && 'is-selected', item.disabled && 'is-disabled', item.isPlaceholder && 'is-placeholder')}
                                onMouseEnter={() => { if (!item.disabled) setActive(i); }}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => choose(i)}
                            >
                                <span className="ak-option-label">{item.label}</span>
                                {item.value === current && <Check size={15} aria-hidden="true" />}
                            </li>
                        </Fragment>
                    ))}
                </ul>,
                document.body,
            )}
        </>
    );
});

/** The browser's own <select>, for the rare case that needs it (e.g. multiple). */
export const NativeSelect = forwardRef(function NativeSelect({ options = [], placeholder, size, className, children, ...props }, ref) {
    return (
        <select ref={ref} className={cx('ak-select', size === 'sm' && 'is-sm', className)} {...props}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map(o => (typeof o === 'object'
                ? <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
                : <option key={o} value={o}>{o}</option>))}
            {children}
        </select>
    );
});

export function Checkbox({ label, checked, onChange, disabled, className, ...props }) {
    return (
        <label className={cx('ak-check', className)}>
            <input type="checkbox" checked={Boolean(checked)} onChange={e => onChange?.(e.target.checked, e)} disabled={disabled} {...props} />
            <span>{label}</span>
        </label>
    );
}

/** An on/off switch; onChange(checked). */
export function Switch({ label, checked, onChange, disabled, className, description }) {
    const id = useId();
    return (
        <label className={cx('ak-switch', className)} htmlFor={id}>
            <input id={id} type="checkbox" role="switch" checked={Boolean(checked)} aria-checked={Boolean(checked)} onChange={e => onChange?.(e.target.checked, e)} disabled={disabled} />
            <span aria-hidden="true" />
            {(label || description) && (
                <span className="ak-switch-text">
                    {label}
                    {description && <span className="ak-hint">{description}</span>}
                </span>
            )}
        </label>
    );
}

/** Buttons at the end of a form. sticky keeps them in view on long forms. */
export function FormActions({ children, sticky = false }) {
    return <div className={sticky ? 'ak-sticky-actions' : 'ak-form-actions'}>{children}</div>;
}
