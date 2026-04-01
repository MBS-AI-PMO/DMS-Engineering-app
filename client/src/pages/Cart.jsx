/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ArrowRight, ShoppingCart, Info, ChevronRight, Package, Box } from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import ProjectViewer from '../components/viewer/ProjectViewer';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, cartTotal } = useCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="cart-empty-state">
        <div className="container">
          <motion.div
            className="empty-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="empty-icon-wrap">
              <ShoppingCart size={48} />
            </div>
            <h2>Your cart is empty</h2>
            <p>You haven't added any manufacturing projects to your cart yet.</p>
            <Link to="/get-instant-pricing" className="btn-primary">
              Start a New Project <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <div className="cart-header">
          <h1>Your Cart</h1>
          <p>{cartItems.length} Project{cartItems.length !== 1 ? 's' : ''} in your cart</p>
        </div>

        <div className="cart-grid">
          <div className="cart-items-column">
            <AnimatePresence>
              {cartItems.map((item) => (
                <motion.div
                  key={item.cartId}
                  className="cart-item-card"
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="cart-item-viewer">
                    <ProjectViewer
                      file={item.file}
                      configuration={item.configuration}
                      isPreview={true}
                    />
                  </div>

                  <div className="cart-item-details">
                    <div className="cart-item-main">
                      <div className="cart-item-info">
                        <h3>{item.fileName}</h3>
                        <div className="config-badges">
                          <span className="badge-metal">{item.configuration.metal?.name || 'Standard Metal'}</span>
                          {item.configuration.anodizingColor && (
                            <span
                              className="badge-anodizing"
                              style={{ borderLeft: `4px solid ${item.configuration.anodizingColor.color}` }}
                            >
                              Anodized: {item.configuration.anodizingColor.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="cart-item-price">
                        ${(item.pricing.total * item.quantity).toFixed(2)}
                        <span>${item.pricing.total.toFixed(2)} / unit</span>
                      </div>
                    </div>

                    <div className="cart-item-actions">
                      <div className="quantity-control">
                        <button onClick={() => updateQuantity(item.cartId, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartId, item.quantity + 1)}>+</button>
                      </div>
                      <button
                        className="btn-remove"
                        onClick={() => removeFromCart(item.cartId)}
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="cart-summary-column">
            <div className="summary-sticky">
              <div className="summary-card">
                <h3>Order Summary</h3>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Estimated Shipping</span>
                  <span className="free">FREE</span>
                </div>
                <div className="summary-divider" />
                <div className="summary-row total">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>

                <button
                  className="btn-checkout-primary"
                  onClick={() => navigate('/checkout')}
                >
                  Proceed to Checkout <ArrowRight size={18} />
                </button>

                <div className="summary-features">
                  <div className="feature-item">
                    <Package size={16} /> <span>Secure Manufacturing</span>
                  </div>
                  <div className="feature-item">
                    <Box size={16} /> <span>Precision Quality Check</span>
                  </div>
                </div>
              </div>

              <div className="summary-help-card">
                <h4>Need assistance?</h4>
                <p>Our engineering team is ready to help with your complex projects.</p>
                <Link to="/contact" className="link-help">Contact Specialist <ChevronRight size={14} /></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
