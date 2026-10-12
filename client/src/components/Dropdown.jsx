import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import '../styles/Dropdown.css';

/**
 * A select that matches the site: a button showing the choice and a white
 * list that pops below it. Works like a native select from the keyboard:
 * arrows, Home/End, Enter or Space to pick, Escape to close, and typing a
 * letter jumps to the next option starting with it.
 *
 * options: [{ value, label }]; value: the picked option's value.
 */
const Dropdown = ({ label, options, value, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const listRef = useRef(null);
    const baseId = useId();
    const labelId = `${baseId}-label`;
    const listId = `${baseId}-list`;
    const optionId = (i) => `${baseId}-opt-${i}`;

    const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
    const selected = options[selectedIndex];

    const openList = (index = selectedIndex) => {
        setActive(index);
        setOpen(true);
    };
    const close = (refocus = true) => {
        setOpen(false);
        if (refocus) buttonRef.current?.focus();
    };
    const choose = (index) => {
        const option = options[index];
        if (option && option.value !== value) onChange(option.value);
        close();
    };

    // Close on a click outside.
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Focus the list when it opens and keep the active option in view.
    useEffect(() => {
        if (!open) return;
        listRef.current?.focus({ preventScroll: true });
        document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

    const jumpToLetter = (key) => {
        const letter = key.toLowerCase();
        for (let step = 1; step <= options.length; step += 1) {
            const i = (active + step) % options.length;
            if (String(options[i].label).toLowerCase().startsWith(letter)) return i;
        }
        return active;
    };

    const onButtonKeyDown = (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            openList(e.key === 'ArrowUp' ? Math.max(selectedIndex - 1, 0) : selectedIndex);
        }
    };

    const onListKeyDown = (e) => {
        const last = options.length - 1;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, last)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(last); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') { setOpen(false); }
        else if (e.key.length === 1 && /\S/.test(e.key)) { setActive(jumpToLetter(e.key)); }
    };

    return (
        <div className={`dd${open ? ' is-open' : ''} ${className}`.trim()} ref={rootRef}>
            {label && <span id={labelId} className="dd-label">{label}</span>}
            <button
                ref={buttonRef}
                type="button"
                className="dd-button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-labelledby={label ? `${labelId} ${baseId}-value` : undefined}
                onClick={() => (open ? close() : openList())}
                onKeyDown={onButtonKeyDown}
            >
                <span id={`${baseId}-value`} className="dd-value">{selected?.label}</span>
                <ChevronDown size={16} className="dd-chevron" aria-hidden="true" />
            </button>

            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    className="dd-list"
                    role="listbox"
                    tabIndex={-1}
                    aria-labelledby={label ? labelId : undefined}
                    aria-activedescendant={optionId(active)}
                    onKeyDown={onListKeyDown}
                >
                    {options.map((option, i) => {
                        const isSelected = i === selectedIndex;
                        return (
                            <li
                                key={`${option.value}`}
                                id={optionId(i)}
                                role="option"
                                aria-selected={isSelected}
                                className={`dd-option${i === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(i)}
                            >
                                <span>{option.label}</span>
                                {isSelected && <Check size={15} aria-hidden="true" />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default Dropdown;
