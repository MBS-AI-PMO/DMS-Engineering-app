import { Ruler } from 'lucide-react';
import { Banner, KeyValue } from '../../../components/admin/ui';

const n = (v, digits = 3) => (v === null || v === undefined ? '—' : String(Math.round(Number(v) * 10 ** digits) / 10 ** digits));
const inches = (v) => `${Number(v).toFixed(3)} in`;

/**
 * What the server measured from the file (it replaces typed sizes):
 * flat size, cut length, pierces, bends and the file's thickness, with a
 * warning when that thickness is not the one priced.
 */
export default function MeasuredPart({ measured, pricedThickness, fileName }) {
    if (!measured) {
        return <Banner tone="warn">The file could not be measured, so it was not priced from the file. Check it opens on the quote page.</Banner>;
    }
    const priced = Number(pricedThickness);
    const fileThickness = measured.thicknessIn;
    const mismatch = fileThickness > 0 && priced > 0 && Math.abs(fileThickness - priced) > 0.003;
    const hems = measured.hems ? ` + ${measured.hems} hem${measured.hems === 1 ? '' : 's'}` : '';
    return (
        <div className="ck-measured">
            <h3 className="ck-h3"><Ruler size={13} aria-hidden="true" className="ck-inline-icon" /> Measured from {fileName || 'the file'}</h3>
            <KeyValue
                items={[
                    ['Flat size', `${n(measured.lengthIn)} × ${n(measured.widthIn)} in`],
                    ['Cut length', `${n(measured.cutLengthIn, 1)} in`],
                    ['Pierces', `${measured.pierces} (+1 for the outline: ${measured.laserPierces} in the laser cost)`],
                    ['Bends', `${measured.bends}${hems}`],
                    ['Thickness', fileThickness > 0 ? `${inches(fileThickness)} in the file · priced at ${inches(priced)}` : `Priced at ${inches(priced)} (the file does not say)`],
                ]}
            />
            {mismatch && (
                <Banner tone="warn">
                    The file is {inches(fileThickness)} thick but the price uses {inches(priced)}. Change Thickness to match if that is wrong.
                </Banner>
            )}
        </div>
    );
}
