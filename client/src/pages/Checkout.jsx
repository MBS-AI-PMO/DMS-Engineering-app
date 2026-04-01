/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ShieldCheck,
    CreditCard,
    Truck,
    ArrowRight,
    ChevronLeft,
    AlertCircle,
    CheckCircle2,
    Package,
    MapPin,
    Phone,
    User,
    Mail
} from 'lucide-react';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/PremiumCheckout.css';

const Checkout = () => {
    const { cartItems, cartTotal, clearCart } = useCart();
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [orderId, setOrderId] = useState(null);

    const [formData, setFormData] = useState({
        email: user?.email || '',
        fullName: user?.name || '',
        phone: '',
        address: '',
        city: '',
        zipCode: ''
    });

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

    const handlePlaceOrder = (e) => {
        if (e) e.preventDefault();
        console.log('Place order triggered');
        if (formRef.current && formRef.current.reportValidity()) {
            console.log('Form is valid, submitting...');
            handleSubmit(e);
        } else {
            console.warn('Form validation failed');
            showToast('Please fill in all shipping details.', 'error');
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        console.log('Submitting order with payload...', { cartItems, cartTotal, formData });

        try {
            // Safety check for cart items and pricing
            if (!cartItems || cartItems.length === 0) {
                showToast('Your cart is empty', 'error');
                return;
            }

            const payload = {
                ...formData,
                items: cartItems.map(item => ({
                    fileName: item.fileName || item.file_name,
                    tempPath: item.tempPath || item.temp_path || '',
                    configuration: item.configuration || {},
                    quantity: item.quantity || 1,
                    unitPrice: item.pricing?.total || 0
                })),
                totalPrice: cartTotal || 0
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('API Response:', data);

            if (data.success) {
                setIsSuccess(true);
                setOrderId(data.orderId);
                clearCart();
                showToast('Order placed successfully!', 'success');
            } else {
                showToast(data.error || 'Failed to place order', 'error');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            showToast('A network error occurred. Please try again.', 'error');
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
                                onSubmit={handleSubmit}
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

                                <div className="section-header" style={{ marginTop: '60px' }}>
                                    <CreditCard size={24} />
                                    <h2>Payment Method</h2>
                                </div>

                                <div className="payment-gateway-card">
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
                                        <div className="check-circle" />
                                    </div>
                                </div>
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
                                                {item.configuration?.anodizingColor && (
                                                    <span>Anodizing: <strong>{item.configuration.anodizingColor.name}</strong></span>
                                                )}
                                                {item.configuration?.selectedTaps && Object.keys(item.configuration.selectedTaps).length > 0 && (
                                                    <span>Taped Holes: <strong>{Object.keys(item.configuration.selectedTaps).length}</strong></span>
                                                )}
                                            </div>
                                            <span className="meta" style={{ marginTop: '10px', display: 'block' }}>
                                                Qty: <strong>{item.quantity || 1}</strong> × ${(item.pricing?.total || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <span className="price">${((item.pricing?.total || 0) * (item.quantity || 1)).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="summary-calculation" style={{ marginTop: '30px' }}>
                                <div className="calc-row">
                                    <span>Subtotal</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="calc-row">
                                    <span>Shipping</span>
                                    <span style={{ color: '#e31b23' }}>FREE</span>
                                </div>
                                <div className="calc-row total">
                                    <span>Total</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePlaceOrder}
                                className="btn-place-order"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Processing Order...' : 'Complete Purchase'}
                                <ArrowRight size={22} />
                            </button>

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
