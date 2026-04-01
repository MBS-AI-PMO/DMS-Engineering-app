/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ArrowRight, ShoppingCart, Info, ChevronRight, Package, Box, PlusCircle } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import ProjectViewer from '../components/viewer/ProjectViewer';
import '../styles/PremiumCart.css';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, cartTotal } = useCart();
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

                    {/* Metadata Spacing Fix */}
                    <div className="item-metadata-labels">
                      <span className="meta-tag">
                        <Box size={14} style={{ marginRight: '6px' }} />
                        {item.configuration?.metal?.name || 'Standard Metal'}
                      </span>
                      <span className="meta-tag secondary">
                        {item.configuration.thickness}mm Thickness
                      </span>
                      {item.configuration.anodizingColor && (
                        <span className="meta-tag">
                          Anodized: {item.configuration.anodizingColor.name}
                        </span>
                      )}
                      {item.configuration.selectedTaps && Object.keys(item.configuration.selectedTaps).length > 0 && (
                        <span className="meta-tag secondary">
                          {Object.keys(item.configuration.selectedTaps).length} Taped Holes
                        </span>
                      )}
                    </div>

                    <div className="item-interaction-row">
                      <div className="qty-control-premium">
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Info size={16} />
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
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
                    <span className="price-unit">${(item.pricing?.total || 0).toFixed(2)} / unit</span>
                    <span className="price-total">
                      ${((item.pricing?.total || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="cart-summary-column">
            <motion.div
              className="cart-summary-premium"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h3 className="summary-title">Order Summary</h3>

              <div className="summary-row">
                <span>Subtotal ({cartItems.length} Projects)</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Production Logistics</span>
                <span style={{ color: '#e31b23', fontWeight: 700 }}>FREE</span>
              </div>

              <div className="summary-row total">
                <span>Estimate Total</span>
                <span>${cartTotal.toFixed(2)}</span>
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
  );
};

export default Cart;
