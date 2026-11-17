/** "42 / 60": turns amber when the text is longer than recommended. */
export default function CharCount({ value, max }) {
    const length = String(value || '').length;
    const over = length > max;
    return (
        <span className={`ac-count${over ? ' is-over' : ''}`} title={over ? `Longer than the recommended ${max} characters` : `Recommended: up to ${max} characters`}>
            {length} / {max}
        </span>
    );
}
