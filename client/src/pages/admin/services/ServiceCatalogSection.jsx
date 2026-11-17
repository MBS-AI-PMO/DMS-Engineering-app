import ColorOptions from './options/ColorOptions';
import TapOptions from './options/TapOptions';
import CountersinkOptions from './options/CountersinkOptions';
import HardwareCatalog from './hardware/HardwareCatalog';

/** The catalog list that belongs to this kind of service, if any. */
export default function ServiceCatalogSection({ kind, options, onChange }) {
    if (kind === 'anodizing' || kind === 'powder') return <ColorOptions options={options} onChange={onChange} powder={kind === 'powder'} />;
    if (kind === 'taps') return <TapOptions options={options} onChange={onChange} />;
    if (kind === 'countersinks') return <CountersinkOptions options={options} onChange={onChange} />;
    if (kind === 'hardware') return <HardwareCatalog />;
    return null;
}
