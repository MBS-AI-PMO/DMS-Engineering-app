/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ArrowRight, ShoppingCart, Info, ChevronRight, Package, Box, PlusCircle, ShieldCheck, Zap, Layers, Settings, TrendingDown } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import ProjectViewer from '../components/viewer/ProjectViewer';
import DiscountTable from '../components/DiscountTable';
import Skeleton from '../components/Skeleton';
import '../styles/PremiumCart.css';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartSubtotal, cartDiscount, allDiscounts } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <motion.div
            className="empty-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="empty-icon-wrap">
              <ShoppingCart size={55} />
              <motion.div
                className="icon-plus-overlay"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                style={{ position: 'absolute', right: -10, bottom: -10, color: '#fff' }}
              >
                <PlusCircle size={28} fill="#e31b23" />
              </motion.div>
            </div>
            <h2>Your cart is empty</h2>
            <p>Ready to bring your engineering designs to life? Upload your STEP files and get instant pricing for precision manufacturing.</p>
            <Link to="/get-instant-pricing" className="btn-primary large">
              Start a New Project <ArrowRight size={22} />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <motion.div
          className="cart-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Manufacturing Cart</h1>
          <p>{cartItems.length} Project{cartItems.length !== 1 ? 's' : ''} staged for production</p>
        </motion.div>

        <div className="cart-grid">
          <div className="cart-items-column">
            <AnimatePresence>
              {cartItems.map((item) => (
                <motion.div
                  key={item.cartId}
                  className="premium-cart-item"
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="cart-preview-wrap">
                    <ProjectViewer
                      file={item.file}
                      configuration={item.configuration}
                      isPreview={true}
                    />
                  </div>

                  <div className="item-main-info">
                    <h2>{item.fileName}</h2>

                    {/* Metadata Sub-Services Display */}
                    <div className="item-metadata-labels">
                      <span className="meta-tag">
                        <Box size={14} />
                        {item.isUpdating ? <Skeleton dark style={{ width: '80px', height: '14px', marginLeft: '6px' }} /> : (item.configuration?.metal?.name || 'Standard Metal')}
                      </span>
                      <span className="meta-tag secondary">
                        <TrendingDown size={14} />
                        {item.isUpdating ? <Skeleton dark style={{ width: '60px', height: '14px', marginLeft: '6px' }} /> : `${item.configuration.thickness}mm Thickness${item.configuration?.selectedThickness ? ` (${item.configuration.selectedThickness})` : ''}`}
                      </span>

                      {/* Detailed Sub-Services */}
                      {(item.configuration.additionalServices || []).map(svc => (
                        <span key={svc.id} className="meta-tag premium">
                          {svc.title.toLowerCase().includes('anodiz') ? <Zap size={14} /> :
                            svc.title.toLowerCase().includes('bend') ? <Layers size={14} /> :
                              <Settings size={14} />}
                          {svc.title}
                          {svc.title.toLowerCase().includes('anodiz') && item.configuration.anodizingColor && (
                            <span className="sub-detail">: {item.configuration.anodizingColor.name}</span>
                          )}
                        </span>
                      ))}

                      {item.configuration.selectedTaps && Object.keys(item.configuration.selectedTaps).length > 0 && (
                        <span className="meta-tag secondary">
                          <Settings size={14} />
                          {Object.keys(item.configuration.selectedTaps).length} Tapped Holes
                        </span>
                      )}

                      {item.configuration?.selectedHardware && Object.keys(item.configuration.selectedHardware).length > 0 && (
                        <span className="meta-tag secondary">
                          <Settings size={14} />
                          {Object.keys(item.configuration.selectedHardware).length} Hardware Inserts
                        </span>
                      )}

                      {item.configuration?.selectedCountersinks && Object.keys(item.configuration.selectedCountersinks).length > 0 && (
                        <span className="meta-tag secondary">
                          <Settings size={14} />
                          {Object.keys(item.configuration.selectedCountersinks).length} Countersinks
                        </span>
                      )}

                      {(Object.keys(item.configuration?.selectedBends || {}).length > 0 || (item.configuration?.detectedBends || []).length > 0) && (
                        <span className="meta-tag secondary">
                          <Layers size={14} />
                          {Math.max(Object.keys(item.configuration?.selectedBends || {}).length, (item.configuration?.detectedBends || []).length)} Bends
                        </span>
                      )}

                      {Object.keys(item.configuration?.selectedFinishColors || {}).length > 0 && (
                        <span className="meta-tag premium">
                          <Zap size={14} />
                          Finish: {Object.values(item.configuration.selectedFinishColors).map(c => c?.name || c?.service_name || c?.service || 'Selected').join(', ')}
                        </span>
                      )}

                      {item.configuration?.dimensions && (
                        <span className="meta-tag" style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: 0 }}>
                          {item.configuration.dimensions.mm.l} × {item.configuration.dimensions.mm.w} × {item.configuration.dimensions.mm.t} mm, {item.configuration.dimensions.mm.volume} mm³
                          {' | '}
                          {item.configuration.dimensions.inches.l} × {item.configuration.dimensions.inches.w} × {item.configuration.dimensions.inches.t} in, {item.configuration.dimensions.inches.volume} in³
                        </span>
                      )}
                    </div>

                    {/* Volume Discount Table */}
                    <DiscountTable
                      allDiscounts={allDiscounts}
                      currentQuantity={item.quantity}
                    />

                    <div className="item-interaction-row">
                      <div className="qty-control-premium">
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          disabled={item.quantity <= 1 || item.isUpdating}
                        >
                          <Info size={16} />
                        </button>
                        <span className="qty-value">
                          {item.isUpdating ? <Skeleton dark style={{ width: '20px', height: '24px' }} /> : item.quantity}
                        </span>
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          disabled={item.isUpdating}
                        >
                          <PlusCircle size={16} />
                        </button>
                      </div>

                      <button
                        className="btn-remove-premium"
                        onClick={() => removeFromCart(item.cartId)}
                      >
                        <Trash2 size={16} /> Remove Project
                      </button>
                    </div>
                  </div>

                  <div className="item-pricing-summary">
                    <div className="price-unit-wrap">
                      {item.isUpdating ? (
                        <Skeleton dark style={{ width: '80px', height: '16px' }} />
                      ) : (
                        item.pricing?.baseUnit > item.pricing?.total ? (
                          <>
                            <span className="price-unit-base" style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.9rem', marginRight: '8px' }}>
                              ${item.pricing.baseUnit.toFixed(2)}
                            </span>
                            <span className="price-unit discounted" style={{ color: '#e31b23', fontWeight: 700 }}>
                              ${(item.pricing?.total || 0).toFixed(2)} / unit
                            </span>
                          </>
                        ) : (
                          <span className="price-unit">
                            ${(item.pricing?.total || 0).toFixed(2)} / unit
                          </span>
                        )
                      )}
                    </div>
                    <span className="price-total">
                      {item.isUpdating ? <Skeleton dark style={{ width: '100px', height: '28px' }} /> : `$${((item.pricing?.total || 0) * (item.quantity || 1)).toFixed(2)}`}
                    </span>

                    {/* Discount Badge */}
                    {!item.isUpdating && item.quantity > 1 && (
                      <div className="applied-discount-badge animate-fade-in">
                        <Zap size={10} fill="#e31b23" />
                        <span>
                          {(() => {
                            const applicableTiers = (allDiscounts || []).filter(d => (d.quantities || []).some(q => q <= item.quantity));
                            if (applicableTiers.length === 0) return 'Volume Discount Applied';
                            const bestTier = applicableTiers.reduce((prev, current) =>
                              (prev.discount_percent > current.discount_percent) ? prev : current
                            );
                            return `${bestTier.discount_percent}% Volume Discount Applied`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="cart-summary-column">
            <div className="cart-summary-sticky-wrapper">
              <motion.div
                className="cart-summary-premium"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h3 className="summary-title">Order Summary</h3>

                <div className="summary-row">
                  <span>Gross Subtotal</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {cartDiscount > 0 && (
                  <div className="summary-row discount-row" style={{ color: '#e31b23' }}>
                    <span>Volume Savings</span>
                    <span>-${cartDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Production Logistics</span>
                  <span style={{ color: '#e31b23', fontWeight: 700 }}>FREE</span>
                </div>

                <div className="summary-row total">
                  <span>Estimate Total</span>
                  <span>
                    {cartItems.some(i => i.isUpdating) ? <Skeleton dark style={{ width: '100px', height: '24px' }} /> : `$${cartTotal.toFixed(2)}`}
                  </span>
                </div>

                <Link to="/checkout" className="btn-checkout-premium">
                  Proceed to Checkout <ArrowRight size={20} />
                </Link>

                <div className="summary-trust-badges">
                  <div className="trust-badge-item">
                    <Package size={18} /> <span>Secure Industrial Manufacturing</span>
                  </div>
                  <div className="trust-badge-item">
                    <ShieldCheck size={18} /> <span>Precision Quality Guarantee</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="summary-help-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                  marginTop: '25px',
                  padding: '30px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '28px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <h4 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Need engineering support?</h4>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                  Our experts are ready to assist with complex tolerances and custom materials.
                </p>
                <Link to="/contact" style={{
                  color: '#e31b23',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '15px',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}>
                  Contact Specialist <ChevronRight size={14} />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
