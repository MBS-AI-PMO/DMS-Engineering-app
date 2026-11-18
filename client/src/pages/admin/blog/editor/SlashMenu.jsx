import { useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * The list under a typed "/": blocks to insert, filtered by what follows
 * the slash. Arrow keys move, Enter or Tab picks, Escape closes (the
 * editor passes keys in through the ref's onKeyDown).
 */
export default function SlashMenu({ items, command, ref }) {
    const [state, setState] = useState({ items, index: 0 });
    const listRef = useRef(null);
    // A new list (new query) starts at the top.
    const index = state.items === items ? state.index : 0;
    if (state.items !== items) setState({ items, index: 0 });

    const pick = (i) => {
        const item = items[i];
        if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: (event) => {
            if (!items.length) return false;
            if (event.key === 'ArrowDown') { setState({ items, index: (index + 1) % items.length }); return true; }
            if (event.key === 'ArrowUp') { setState({ items, index: (index - 1 + items.length) % items.length }); return true; }
            if (event.key === 'Enter' || event.key === 'Tab') { pick(index); return true; }
            return false;
        },
    }));

    useEffect(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    if (!items.length) {
        return <div className="be-slash is-empty" role="status">No block called that. Keep typing text, or press Escape.</div>;
    }
    return (
        <div className="be-slash" role="listbox" aria-label="Insert a block" ref={listRef}>
            <div className="be-slash-label">Insert</div>
            {items.map((item, i) => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="option"
                        aria-selected={i === index}
                        className={`be-slash-item${i === index ? ' is-active' : ''}`}
                        onMouseEnter={() => setState({ items, index: i })}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pick(i)}
                    >
                        <span className="be-slash-icon" aria-hidden="true"><Icon size={17} /></span>
                        <span className="be-slash-text">
                            <span className="be-slash-title">{item.title}</span>
                            <span className="be-slash-hint">{item.hint}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
