import { Modal } from '../../../components/admin/ui';

/** A picture shown large in a dialog. image: { src, title } or null. */
export default function ImageZoom({ image, onClose }) {
    if (!image?.src) return null;
    return (
        <Modal title={image.title || 'Picture'} size="lg" onClose={onClose}>
            <img className="cat-zoom" src={image.src} alt={image.title || ''} />
        </Modal>
    );
}
