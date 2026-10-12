import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { ArrowRight, Layers, Minus, Plus, Settings, ShieldCheck, ShoppingBag, Trash2, Package, Droplet } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import ProjectViewer from '../components/viewer/ProjectViewer';
import { displayMetalName } from '../utils/metalDisplay';
import '../styles/Shimmer.css';
import '../styles/CartPage.css';

/**
 * The cart: a short dark heading band, then each part as a white panel
 * (3D preview, what it is, what was added to it, quantity, price) and the
 * order summary beside them, which stays in view, with the one red action.
 * Quantities, removal, volume discounts and totals work exactly as before;
 * prices shimmer while a quantity change is being re-priced.
 */

const TIER_QUANTITIES = [2, 5, 10, 50, 100, 1000];

// Volume discount tiers that apply to this cart, the one reached marked.
const VolumeTiers = ({ allDiscounts, quantity }) => {
    if (!allDiscounts || allDiscounts.length === 0) return null;
    const tiers = TIER_QUANTITIES.filter(q => allDiscounts.some(d => (d.quantities || []).some(t => t <= q)));
    if (tiers.length === 0) return null;
    return (
        <div className="cr-tiers">
            <span className="cr-tiers-label">Volume discounts</span>
            <ul className="cr-tiers-list">
                {tiers.map((qty, i) => {
                    const best = allDiscounts
                        .filter(d => (d.quantities || []).some(t => t <= qty))
                        .reduce((a, b) => (a.discount_percent > b.discount_percent ? a : b));
                    const reached = quantity >= qty && (i === tiers.length - 1 || quantity < tiers[i + 1]);
                    return (
                        <li key={qty} className={`cr-tier${reached ? ' is-on' : ''}`}>
                            <span className="cr-tier-qty">{qty}+</span>
                            <span className="cr-tier-pct">−{best.discount_percent}%</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const Shimmer = ({ w, h = 14 }) => <span className="shimmer cr-sk" style={{ width: w, height: h }} aria-hidden="true" />;

const Cart = () => {
    const { cartItems, removeFromCart, updateQuantity, cartTotal, cartSubtotal, cartDiscount, allDiscounts } = useCart();
    const reduceMotion = useReducedMotion();
    const count = cartItems.length;
    const anyUpdating = cartItems.some(i => i.isUpdating);

    return (
        <div className="cr">
            <section className="cr-hero" aria-labelledby="cr-title">
                <div className="cr-inner">
                    <nav className="cr-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Cart</span>
                    </nav>
                    <h1 id="cr-title" className="cr-title">Your cart</h1>
                    <p className="cr-lede">
                        {count === 0 ? 'Nothing here yet.' : `${count} ${count === 1 ? 'part' : 'parts'} ready to order`}
                    </p>
                </div>
            </section>

            <section className="cr-body" aria-label="Cart">
                <div className="cr-inner">
                    {count === 0 ? (
                        <div className="cr-empty">
                            <span className="cr-empty-icon" aria-hidden="true"><ShoppingBag size={24} /></span>
                            <h2 className="cr-h2">Your cart is empty</h2>
                            <p>Upload a STEP or DXF file to get an instant price, then add the part here.</p>
                            <Link to="/get-instant-pricing" className="cr-btn is-primary">
                                Get instant pricing
                                <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                        </div>
                    ) : (
                        <div className="cr-layout">
                            <ul className="cr-items">
                                <AnimatePresence initial={false}>
                                    {cartItems.map((item) => {
                                        const config = item.configuration || {};
                                        const unitPrice = item.pricing?.total || 0;
                                        const lineTotal = unitPrice * (item.quantity || 1);
                                        const hasBaseDiscount = item.pricing?.baseUnit > item.pricing?.total;
                                        const tapCount = Object.keys(config.selectedTaps || {}).length;
                                        const hardwareCount = Object.keys(config.selectedHardware || {}).length;
                                        const countersinkCount = Object.keys(config.selectedCountersinks || {}).length;
                                        const bendCount = Math.max(Object.keys(config.selectedBends || {}).length, (config.detectedBends || []).length);
                                        const finishNames = Object.values(config.selectedFinishColors || {})
                                            .map(c => c?.name || c?.service_name || c?.service || 'Selected');
                                        const thicknessText = config.selectedThickness
                                            ? `${config.selectedThickness}${config.thickness ? ` · model ${config.thickness} mm` : ''}`
                                            : (config.thickness ? `${config.thickness} mm` : '—');
                                        const volumeNote = (() => {
                                            if (item.quantity <= 1) return null;
                                            const tiers = (allDiscounts || []).filter(d => (d.quantities || []).some(q => q <= item.quantity));
                                            if (tiers.length === 0) return null;
                                            const best = tiers.reduce((a, b) => (a.discount_percent > b.discount_percent ? a : b));
                                            return `${best.discount_percent}% volume discount applied`;
                                        })();

                                        return (
                                            <motion.li
                                                key={item.cartId}
                                                className="cr-item"
                                                layout={!reduceMotion}
                                                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                                            >
                                                <div className="cr-preview">
                                                    <ProjectViewer
                                                        file={item.file}
                                                        tempPath={item.tempPath || config.tempPath || null}
                                                        configuration={config}
                                                        isPreview={true}
                                                    />
                                                </div>

                                                <div className="cr-main">
                                                    <div className="cr-main-head">
                                                        <h2 className="cr-name" title={item.fileName}>{item.fileName}</h2>
                                                        <div className="cr-price">
                                                            <strong className="cr-price-total">
                                                                {item.isUpdating ? <Shimmer w={96} h={24} /> : `$${lineTotal.toFixed(2)}`}
                                                            </strong>
                                                            <span className="cr-price-unit">
                                                                {item.isUpdating ? <Shimmer w={80} h={11} /> : hasBaseDiscount ? (
                                                                    <><s>${item.pricing.baseUnit.toFixed(2)}</s> ${unitPrice.toFixed(2)} each</>
                                                                ) : `$${unitPrice.toFixed(2)} each`}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <dl className="cr-specs">
                                                        <div>
                                                            <dt>Material</dt>
                                                            <dd>{item.isUpdating ? <Shimmer w={110} /> : displayMetalName(config.metal?.name || 'Standard metal')}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>Thickness</dt>
                                                            <dd>{item.isUpdating ? <Shimmer w={80} /> : thicknessText}</dd>
                                                        </div>
                                                        {config.dimensions && (
                                                            <div className="is-wide">
                                                                <dt>Size</dt>
                                                                <dd>
                                                                    {config.dimensions.mm.l} × {config.dimensions.mm.w} × {config.dimensions.mm.t} mm
                                                                    <span className="cr-sub">
                                                                        {config.dimensions.inches.l} × {config.dimensions.inches.w} × {config.dimensions.inches.t} in
                                                                    </span>
                                                                </dd>
                                                            </div>
                                                        )}
                                                    </dl>

                                                    {((config.additionalServices || []).length > 0 || tapCount || hardwareCount || countersinkCount || bendCount || finishNames.length > 0) ? (
                                                        <ul className="cr-chips" aria-label="Added to this part">
                                                            {(config.additionalServices || []).map(svc => (
                                                                <li key={svc.id} className="cr-chip">
                                                                    {/bend/i.test(svc.title) ? <Layers size={13} aria-hidden="true" /> : <Settings size={13} aria-hidden="true" />}
                                                                    {svc.title}
                                                                    {/anodiz/i.test(svc.title) && config.anodizingColor && <span className="cr-chip-sub">{config.anodizingColor.name}</span>}
                                                                </li>
                                                            ))}
                                                            {tapCount > 0 && <li className="cr-chip"><Settings size={13} aria-hidden="true" />{tapCount} tapped {tapCount === 1 ? 'hole' : 'holes'}</li>}
                                                            {hardwareCount > 0 && <li className="cr-chip"><Settings size={13} aria-hidden="true" />{hardwareCount} hardware {hardwareCount === 1 ? 'insert' : 'inserts'}</li>}
                                                            {countersinkCount > 0 && <li className="cr-chip"><Settings size={13} aria-hidden="true" />{countersinkCount} {countersinkCount === 1 ? 'countersink' : 'countersinks'}</li>}
                                                            {bendCount > 0 && <li className="cr-chip"><Layers size={13} aria-hidden="true" />{bendCount} {bendCount === 1 ? 'bend' : 'bends'}</li>}
                                                            {finishNames.length > 0 && <li className="cr-chip"><Droplet size={13} aria-hidden="true" />Finish: {finishNames.join(', ')}</li>}
                                                        </ul>
                                                    ) : null}

                                                    <VolumeTiers allDiscounts={allDiscounts} quantity={item.quantity} />

                                                    <div className="cr-actions">
                                                        <div className="cr-qty" role="group" aria-label={`Quantity of ${item.fileName}`}>
                                                            <button
                                                                type="button"
                                                                aria-label="One fewer"
                                                                onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                                                                disabled={item.quantity <= 1 || item.isUpdating}
                                                            >
                                                                <Minus size={15} aria-hidden="true" />
                                                            </button>
                                                            <span className="cr-qty-value" aria-live="polite">
                                                                {item.isUpdating ? <Shimmer w={18} h={16} /> : item.quantity}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label="One more"
                                                                onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                                                                disabled={item.isUpdating}
                                                            >
                                                                <Plus size={15} aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                        {volumeNote && !item.isUpdating && <span className="cr-volume">{volumeNote}</span>}
                                                        <button type="button" className="cr-remove" onClick={() => removeFromCart(item.cartId)}>
                                                            <Trash2 size={15} aria-hidden="true" /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.li>
                                        );
                                    })}
                                </AnimatePresence>
                            </ul>

                            <aside className="cr-side">
                                <section className="cr-summary" aria-labelledby="cr-summary-title">
                                    <h2 id="cr-summary-title" className="cr-h2">Order summary</h2>
                                    <dl className="cr-lines">
                                        <div>
                                            <dt>Subtotal</dt>
                                            <dd>{anyUpdating ? <Shimmer w={70} /> : `$${cartSubtotal.toFixed(2)}`}</dd>
                                        </div>
                                        {cartDiscount > 0 && (
                                            <div className="cr-saving">
                                                <dt>Volume savings</dt>
                                                <dd>{anyUpdating ? <Shimmer w={60} /> : `−$${cartDiscount.toFixed(2)}`}</dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt>Production logistics</dt>
                                            <dd className="cr-free">Free</dd>
                                        </div>
                                    </dl>
                                    <div className="cr-total">
                                        <span>Estimated total</span>
                                        <strong>{anyUpdating ? <Shimmer w={110} h={28} /> : `$${cartTotal.toFixed(2)}`}</strong>
                                    </div>
                                    <Link
                                        to="/checkout"
                                        className={`cr-btn is-primary is-block${anyUpdating ? ' is-waiting' : ''}`}
                                        aria-disabled={anyUpdating || undefined}
                                        onClick={(e) => { if (anyUpdating) e.preventDefault(); }}
                                    >
                                        Proceed to checkout
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </Link>
                                    <ul className="cr-trust">
                                        <li><Package size={15} aria-hidden="true" /> Secure industrial manufacturing</li>
                                        <li><ShieldCheck size={15} aria-hidden="true" /> Precision quality guarantee</li>
                                    </ul>
                                </section>

                                <section className="cr-help">
                                    <h2 className="cr-help-title">Need help with a part?</h2>
                                    <p>Our engineers can help with tight tolerances and custom materials.</p>
                                    <Link to="/contact" className="cr-link">
                                        Talk to us
                                        <ArrowRight size={15} aria-hidden="true" />
                                    </Link>
                                </section>
                            </aside>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Cart;
