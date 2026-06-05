/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ShieldCheck, CreditCard, Truck, ArrowRight, ChevronLeft,
    AlertCircle, CheckCircle2, Package, MapPin, Phone, User, Mail, Zap
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchPaymentConfig, createPaypalOrder, capturePaypalOrder } from '../utils/api';
import '../styles/PremiumCheckout.css';

const normalizeOrderTempPath = (value) => {
    let raw = String(value || '').trim();
    if (!raw) return '';

    try {
        if (/^https?:\/\//i.test(raw)) {
            raw = new URL(raw).pathname;
        }
    } catch {
        return '';
    }

    raw = raw.replace(/^\/+/, '');
    if (raw.startsWith('api/temp_uploads/')) return raw.replace(/^api\//, '');
    if (raw.startsWith('temp_uploads/')) return raw;
    if (raw.startsWith('uploads/orders/')) return raw;
    return raw;
};

const Checkout = () => {
    const { cartItems, cartTotal, cartSubtotal, cartDiscount, clearCart } = useCart();
    const { user } = useAuth();
    const showToast = useToast();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [orderId, setOrderId] = useState(null);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);
    const [paymentConfig, setPaymentConfig] = useState({ cod_enabled: true, paypal_enabled: false, paypal_client_id: '', paypal_mode: 'sandbox' });

    const [formData, setFormData] = useState({
        email: user?.email || '',
        fullName: user?.name || '',
        phone: '',
        address: '',
        city: '',
        zipCode: ''
    });

    useEffect(() => {
        setPaymentConfigLoading(true);
        fetchPaymentConfig()
            .then(cfg => {
                setPaymentConfig(cfg);
                // Default to first enabled method
                if (cfg.cod_enabled) setSelectedPayment('cod');
                else if (cfg.paypal_enabled) setSelectedPayment('paypal');
            })
            .catch(() => {
                // Fallback: COD only
                setPaymentConfig({ cod_enabled: true, paypal_enabled: false, paypal_client_id: '', paypal_mode: 'sandbox' });
                setSelectedPayment('cod');
            })
            .finally(() => setPaymentConfigLoading(false));
    }, []);

    useEffect(() => {
        if (cartItems.length === 0 && !isSuccess) {
            navigate('/get-instant-pricing');
        }
    }, [cartItems, isSuccess, navigate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const formRef = React.useRef(null);

    const validateForm = () => {
        if (!formRef.current) return false;
        if (!formRef.current.reportValidity()) {
            showToast('Please fill in all shipping details.', 'error');
            return false;
        }
        return true;
    };

    const handlePlaceOrder = (e, paymentMethod = 'cod', paymentId = null) => {
        if (e) e.preventDefault();
        if (!validateForm()) return;
        submitOrder(paymentMethod, paymentId);
    };

    const submitOrder = async (paymentMethod = 'cod', paymentId = null) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            if (!cartItems || cartItems.length === 0) {
                showToast('Your cart is empty', 'error');
                return;
            }

            const normalizedItems = cartItems.map(item => ({
                fileName: item.fileName || item.file_name,
                tempPath: normalizeOrderTempPath(item.tempPath || item.temp_path || item.file?.path || ''),
                configuration: item.configuration || {},
                quantity: item.quantity || 1,
                unitPrice: item.pricing?.total || 0
            }));

            if (normalizedItems.some(item => !item.tempPath)) {
                showToast({
                    title: 'Order Failed',
                    message: 'One or more uploaded files are no longer available. Please re-upload the file and try again.'
                }, 'error');
                return;
            }

            const payload = {
                ...formData,
                payment_method: paymentMethod,
                payment_id: paymentId,
                items: normalizedItems,
                totalPrice: cartTotal || 0
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                setIsSuccess(true);
                setOrderId(data.orderId);
                clearCart();
                showToast({ title: 'Order Confirmed!', message: `Order #${data.orderId} placed successfully` }, 'success');
            } else {
                showToast({ title: 'Order Failed', message: data.error || 'Failed to place order' }, 'error');
            }
        } catch (err) {
            showToast({ title: 'Network Error', message: 'Please check your connection and try again.' }, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="checkout-success-page cart-empty-state">
                <div className="container">
                    <motion.div
                        className="empty-card"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <div className="empty-icon-wrap">
                            <CheckCircle2 size={64} style={{ color: '#e31b23' }} />
                        </div>
                        <h2>Order Confirmed!</h2>
                        <p className="order-number" style={{ color: '#fff', fontSize: '1.4rem' }}>Order ID: <strong>#{orderId}</strong></p>
                        <p className="success-msg">Your manufacturing request has been received and is being processed by our engineering team.</p>

                        <div className="success-actions" style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '40px' }}>
                            <Link to="/orders" className="btn-primary large">View My Orders</Link>
                            <Link to="/" className="btn-primary large" style={{ background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }}>Return Home</Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    const paypalInitialOptions = paymentConfig.paypal_client_id
        ? {
            'client-id': paymentConfig.paypal_client_id,
            currency: 'USD',
            intent: 'capture',
        }
        : null;

    return (
        <div className="checkout-page">
            <div className="container">
                <div className="checkout-back">
                    <Link to="/cart">
                        <ChevronLeft size={18} /> Back to Cart
                    </Link>
                </div>

                <div className="checkout-grid">
                    <div className="checkout-form-column">
                        <motion.div
                            className="premium-section-card"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <div className="section-header">
                                <MapPin size={24} />
                                <h2>Shipping Information</h2>
                            </div>

                            <form
                                id="checkout-form"
                                ref={formRef}
                                onSubmit={e => e.preventDefault()}
                                className="premium-form"
                            >
                                <div className="form-group" style={{ marginBottom: '35px' }}>
                                    <label htmlFor="fullName">Full Name</label>
                                    <div className="input-with-icon">
                                        <User size={18} />
                                        <input
                                            type="text" id="fullName" name="fullName"
                                            placeholder="Enter your full name"
                                            value={formData.fullName}
                                            onChange={handleInputChange} required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="email">Email Address</label>
                                        <div className="input-with-icon">
                                            <Mail size={18} />
                                            <input
                                                type="email" id="email" name="email"
                                                placeholder="email@example.com"
                                                value={formData.email}
                                                onChange={handleInputChange} required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone">Phone Number</label>
                                        <div className="input-with-icon">
                                            <Phone size={18} />
                                            <input
                                                type="tel" id="phone" name="phone"
                                                placeholder="+1 (555) 000-0000"
                                                value={formData.phone}
                                                onChange={handleInputChange} required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '35px' }}>
                                    <label htmlFor="address">Street Address</label>
                                    <div className="input-with-icon">
                                        <MapPin size={18} />
                                        <input
                                            type="text" id="address" name="address"
                                            placeholder="123 Manufacturing Way"
                                            value={formData.address}
                                            onChange={handleInputChange} required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="city">City</label>
                                        <input
                                            type="text" id="city" name="city"
                                            placeholder="Precision City"
                                            value={formData.city}
                                            onChange={handleInputChange} required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="zipCode">Zip Code</label>
                                        <input
                                            type="text" id="zipCode" name="zipCode"
                                            placeholder="12345"
                                            value={formData.zipCode}
                                            onChange={handleInputChange} required
                                        />
                                    </div>
                                </div>

                                {/* ── Payment Method Selection ─────────────── */}
                                <div className="section-header" style={{ marginTop: '60px' }}>
                                    <CreditCard size={24} />
                                    <h2>Payment Method</h2>
                                </div>

                                <div className="checkout-payment-methods">
                                    {paymentConfigLoading && (
                                        <>
                                            {[0, 1].map(idx => (
                                                <div key={idx} className="payment-gateway-card checkout-payment-skeleton" aria-hidden="true">
                                                    <div className="gateway-info">
                                                        <span className="skeleton checkout-skeleton-icon" />
                                                        <div className="gateway-text">
                                                            <span className="skeleton checkout-skeleton-title" />
                                                            <span className="skeleton checkout-skeleton-line" />
                                                        </div>
                                                    </div>
                                                    <span className="skeleton checkout-skeleton-toggle" />
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {!paymentConfigLoading && paymentConfig.cod_enabled && (
                                        <div
                                            className={`payment-gateway-card${selectedPayment === 'cod' ? ' selected' : ''}`}
                                            onClick={() => setSelectedPayment('cod')}
                                        >
                                            <div className="gateway-info">
                                                <div className="gateway-icon" style={{ color: '#e31b23' }}>
                                                    <Truck size={30} />
                                                </div>
                                                <div className="gateway-text">
                                                    <span className="gateway-name" style={{ color: 'white' }}>Cash on Delivery (COD)</span>
                                                    <span className="gateway-desc" style={{ color: 'white' }}>Pay when your parts arrive at your doorstep.</span>
                                                </div>
                                            </div>
                                            <div className="gateway-check">
                                                <div className={`check-circle${selectedPayment === 'cod' ? ' active' : ''}`} />
                                            </div>
                                        </div>
                                    )}

                                    {!paymentConfigLoading && paymentConfig.paypal_enabled && paypalInitialOptions && (
                                        <div
                                            className={`payment-gateway-card${selectedPayment === 'paypal' ? ' selected' : ''}`}
                                            onClick={() => setSelectedPayment('paypal')}
                                        >
                                            <div className="gateway-info">
                                                <div className="gateway-icon">
                                                    <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
                                                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z" fill="#009cde"/>
                                                    </svg>
                                                </div>
                                                <div className="gateway-text">
                                                    <span className="gateway-name" style={{ color: 'white' }}>PayPal</span>
                                                    <span className="gateway-desc" style={{ color: 'white' }}>
                                                        Pay securely via PayPal{paymentConfig.paypal_mode === 'sandbox' ? ' (Sandbox)' : ''}.
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="gateway-check">
                                                <div className={`check-circle${selectedPayment === 'paypal' ? ' active' : ''}`} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* PayPal Buttons — shown inline when PayPal is selected */}
                                {selectedPayment === 'paypal' && paypalInitialOptions && (
                                    <div style={{ marginTop: 20 }}>
                                        <PayPalScriptProvider options={paypalInitialOptions}>
                                            <PayPalButtons
                                                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                                                disabled={isSubmitting}
                                                createOrder={async () => {
                                                    if (!validateForm()) throw new Error('Form incomplete');
                                                    return createPaypalOrder(cartTotal);
                                                }}
                                                onApprove={async (data) => {
                                                    try {
                                                        const result = await capturePaypalOrder(data.orderID);
                                                        await submitOrder('paypal', result.paymentId || data.orderID);
                                                    } catch (err) {
                                                        showToast({ title: 'Payment Failed', message: err.message || 'PayPal capture failed' }, 'error');
                                                    }
                                                }}
                                                onError={(err) => {
                                                    showToast({ title: 'PayPal Error', message: String(err) }, 'error');
                                                }}
                                                onCancel={() => {
                                                    showToast('PayPal payment cancelled.', 'info');
                                                }}
                                            />
                                        </PayPalScriptProvider>
                                    </div>
                                )}
                            </form>
                        </motion.div>
                    </div>

                    <div className="checkout-summary-column">
                        <motion.div
                            className="summary-card"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <h3>Order Summary</h3>
                            <div className="summary-items-list">
                                {cartItems.map((item) => (
                                    <div key={item.cartId} className="summary-item">
                                        <div className="summary-item-info">
                                            <span className="name">{item.fileName}</span>
                                            <div className="details-grid" style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr',
                                                gap: '4px',
                                                marginTop: '6px',
                                                fontSize: '0.8rem',
                                                color: 'rgba(255,255,255,0.35)'
                                            }}>
                                                <span>Material: <strong>{item.configuration?.metal?.name || 'Standard Metal'}</strong></span>
                                                <span>Thickness: <strong>{item.configuration?.thickness || '0'}mm</strong></span>
                                                {(item.configuration?.additionalServices || []).length > 0 && (
                                                    <span>
                                                        Services: <strong>{item.configuration.additionalServices.map(s => s.title).join(', ')}</strong>
                                                    </span>
                                                )}
                                                {item.configuration?.anodizingColor && (
                                                    <span>Anodizing: <strong>{item.configuration.anodizingColor.name}</strong></span>
                                                )}
                                                {Object.keys(item.configuration?.selectedFinishColors || {}).length > 0 && (
                                                    <span>
                                                        Finish Options: <strong>{Object.values(item.configuration.selectedFinishColors).map(c => c?.name || c?.service_name || c?.service || 'Selected').join(', ')}</strong>
                                                    </span>
                                                )}
                                                {item.configuration?.selectedTaps && Object.keys(item.configuration.selectedTaps).length > 0 && (
                                                    <span>Tapped Holes: <strong>{Object.keys(item.configuration.selectedTaps).length}</strong></span>
                                                )}
                                                {item.configuration?.selectedHardware && Object.keys(item.configuration.selectedHardware).length > 0 && (
                                                    <span>Hardware Inserts: <strong>{Object.keys(item.configuration.selectedHardware).length}</strong></span>
                                                )}
                                                {item.configuration?.selectedCountersinks && Object.keys(item.configuration.selectedCountersinks).length > 0 && (
                                                    <span>Countersinks: <strong>{Object.keys(item.configuration.selectedCountersinks).length}</strong></span>
                                                )}
                                                {(Object.keys(item.configuration?.selectedBends || {}).length > 0 || (item.configuration?.detectedBends || []).length > 0) && (
                                                    <span>
                                                        Bends: <strong>{Math.max(Object.keys(item.configuration?.selectedBends || {}).length, (item.configuration?.detectedBends || []).length)}</strong>
                                                    </span>
                                                )}
                                                {item.configuration?.dimensions && (
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                                        Measurement: {item.configuration.dimensions.mm.l} × {item.configuration.dimensions.mm.w} × {item.configuration.dimensions.mm.t} mm, {item.configuration.dimensions.mm.volume} mm³ | {item.configuration.dimensions.inches.l} × {item.configuration.dimensions.inches.w} × {item.configuration.dimensions.inches.t} in, {item.configuration.dimensions.inches.volume} in³
                                                    </span>
                                                )}
                                            </div>
                                            <span className="meta" style={{ marginTop: '10px', display: 'block' }}>
                                                Qty: <strong>{item.quantity || 1}</strong> × 
                                                <span style={{ marginLeft: '4px' }}>
                                                    {item.pricing?.baseUnit > item.pricing?.total ? (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: '6px' }}>
                                                                ${item.pricing.baseUnit.toFixed(2)}
                                                            </span>
                                                            <strong style={{ color: '#e31b23' }}>${(item.pricing?.total || 0).toFixed(2)}</strong>
                                                        </>
                                                    ) : (
                                                        <strong>${(item.pricing?.total || 0).toFixed(2)}</strong>
                                                    )}
                                                </span>
                                                {item.quantity > 1 && (
                                                    <span style={{ color: '#e31b23', fontSize: '0.7rem', fontWeight: 900, marginLeft: '8px', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <Zap size={8} fill="#e31b23" /> Discounted
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <span className="price">${((item.pricing?.total || 0) * (item.quantity || 1)).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="summary-calculation" style={{ marginTop: '30px' }}>
                                <div className="calc-row">
                                    <span>Gross Subtotal</span>
                                    <span>${cartSubtotal.toFixed(2)}</span>
                                </div>
                                {cartDiscount > 0 && (
                                    <div className="calc-row" style={{ color: '#e31b23' }}>
                                        <span>Volume Savings</span>
                                        <span>-${cartDiscount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="calc-row">
                                    <span>Shipping</span>
                                    <span style={{ color: '#e31b23', fontWeight: 700 }}>FREE</span>
                                </div>
                                <div className="calc-row total">
                                    <span>Total</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* COD place order button — hidden when PayPal is selected */}
                            {selectedPayment !== 'paypal' && (
                                <button
                                    type="button"
                                    onClick={handlePlaceOrder}
                                    className="btn-place-order"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processing Order...' : 'Complete Purchase'}
                                    <ArrowRight size={22} />
                                </button>
                            )}

                            {selectedPayment === 'paypal' && (
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginTop: 16 }}>
                                    Use the PayPal button above to complete your payment.
                                </p>
                            )}

                            <div className="security-badges">
                                <div className="badge-item">
                                    <ShieldCheck size={18} /> <span>Secure Checkout</span>
                                </div>
                                <div className="badge-item">
                                    <Package size={18} /> <span>Quality Inspected</span>
                                </div>
                            </div>
                        </motion.div>

                        {!user && (
                            <motion.div
                                className="checkout-login-prompt"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                style={{
                                    marginTop: '30px',
                                    padding: '25px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    gap: '15px',
                                    alignItems: 'center'
                                }}
                            >
                                <AlertCircle size={24} style={{ color: '#e31b23' }} />
                                <div>
                                    <p style={{ margin: 0, fontWeight: 700 }}>Checking out as a guest?</p>
                                    <Link to="/login?redirect=/checkout" style={{ color: '#e31b23', textDecoration: 'none', fontSize: '0.9rem' }}>Login for a faster experience</Link>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
