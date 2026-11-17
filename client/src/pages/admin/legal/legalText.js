/*
 * How the public legal pages read a section (same rules as
 * components/LegalDocument.jsx, kept in step with it so the admin preview
 * matches): blank lines split paragraphs; lines starting with "-", "*" or
 * "•" make a bulleted list, "1." or "1)" a numbered one; list rows typed as
 * separate paragraphs join into one list.
 */

export const DOCUMENTS = {
    privacy: { label: 'Privacy policy', path: '/privacy-policy' },
    terms: { label: 'Terms of service', path: '/terms-of-service' },
};

// Natural order by number ("2" before "10"), then position.
export const sortSections = (rows) => [...rows].sort((a, b) => {
    const byNumber = String(a.serial_number || '').localeCompare(String(b.serial_number || ''), undefined, { numeric: true });
    return byNumber || (a.display_order || 0) - (b.display_order || 0);
});

const toBlocks = (text) => {
    const blocks = [];
    String(text ?? '').split(/\n\s*\n/).forEach((chunk) => {
        let para = [];
        let list = null;
        const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join('\n') }); para = []; };
        const flushList = () => { if (list) blocks.push(list); list = null; };
        chunk.split('\n').map(line => line.trim()).filter(Boolean).forEach((line) => {
            const bullet = line.match(/^[-*•]\s+(.+)$/);
            const number = line.match(/^(\d+)[.)]\s+(.+)$/);
            if (bullet || number) {
                const type = bullet ? 'ul' : 'ol';
                flushPara();
                if (!list || list.type !== type) {
                    flushList();
                    list = { type, start: number ? Number(number[1]) : 1, items: [] };
                }
                list.items.push(bullet ? bullet[1] : number[2]);
            } else {
                flushList();
                para.push(line);
            }
        });
        flushPara();
        flushList();
    });
    return blocks;
};

const mergeLists = (blocks) => blocks.reduce((out, block) => {
    const prev = out[out.length - 1];
    if (prev && block.type !== 'p' && prev.type === block.type) out[out.length - 1] = { ...prev, items: [...prev.items, ...block.items] };
    else out.push(block);
    return out;
}, []);

/* A section's paragraphs (strings) -> [{ type: 'p', text } | { type: 'ul'|'ol', start, items }]. */
export const sectionBlocks = (paragraphs) => mergeLists((paragraphs || []).flatMap(toBlocks));
