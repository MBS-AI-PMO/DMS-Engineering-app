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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...formData,
                items: cartItems.map(item => ({
                    fileName: item.fileName,
                    tempPath: item.tempPath,
                    configuration: item.configuration,
                    quantity: item.quantity,
                    unitPrice: item.pricing.total
                })),
                totalPrice: cartTotal
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
            <div className="checkout-success-page">
                <div className="container">
                    <motion.div
                        className="success-card"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <div className="success-icon-wrap">
                            <CheckCircle2 size={64} className="text-success" />
                        </div>
                        <h1>Order Confirmed!</h1>
                        <p className="order-number">Order ID: <strong>#{orderId}</strong></p>
                        <p className="success-msg">Your manufacturing request has been received and is being processed by our engineering team.</p>

                        <div className="success-actions">
                            <Link to="/orders" className="btn-primary">View My Orders</Link>
                            <Link to="/" className="btn-secondary">Return Home</Link>
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
                        <section className="checkout-section">
                            <div className="section-header">
                                <User size={20} />
                                <h2>Shipping Information</h2>
                            </div>

                            <form id="checkout-form" onSubmit={handleSubmit} className="premium-form">
                                <div className="form-row">
                                    <div className="form-group full">
                                        <label htmlFor="fullName">Full Name</label>
                                        <div className="input-with-icon">
                                            <User size={16} />
                                            <input
                                                type="text" id="fullName" name="fullName"
                                                placeholder="Enter your full name"
                                                value={formData.fullName}
                                                onChange={handleInputChange} required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="email">Email Address</label>
                                        <div className="input-with-icon">
                                            <Mail size={16} />
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
                                            <Phone size={16} />
                                            <input
                                                type="tel" id="phone" name="phone"
                                                placeholder="+1 (555) 000-0000"
                                                value={formData.phone}
                                                onChange={handleInputChange} required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="address">Street Address</label>
                                    <div className="input-with-icon">
                                        <MapPin size={16} />
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

                                <div className="checkout-section mt-5">
                                    <div className="section-header">
                                        <CreditCard size={20} />
                                        <h2>Payment Method</h2>
                                    </div>
                                    <div className="payment-gateway-card active">
                                        <div className="gateway-info">
                                            <div className="gateway-icon">
                                                <Truck size={20} />
                                            </div>
                                            <div className="gateway-text">
                                                <span className="gateway-name">Cash on Delivery (COD)</span>
                                                <span className="gateway-desc">Pay when your parts arrive at your doorstep.</span>
                                            </div>
                                        </div>
                                        <div className="gateway-check">
                                            <div className="check-circle active" />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </section>
                    </div>

                    <div className="checkout-summary-column">
                        <div className="summary-sticky">
                            <div className="summary-card">
                                <h3>Order Summary</h3>
                                <div className="summary-items-list hide-scrollbar">
                                    {cartItems.map((item) => (
                                        <div key={item.cartId} className="summary-item">
                                            <div className="summary-item-info">
                                                <span className="name">{item.fileName}</span>
                                                <span className="meta">Qty: {item.quantity} × ${item.pricing.total.toFixed(2)}</span>
                                            </div>
                                            <span className="price">${(item.pricing.total * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="summary-divider" />

                                <div className="summary-calculation">
                                    <div className="calc-row">
                                        <span>Subtotal</span>
                                        <span>${cartTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="calc-row">
                                        <span>Shipping</span>
                                        <span className="free">FREE</span>
                                    </div>
                                    <div className="calc-row total">
                                        <span>Total</span>
                                        <span>${cartTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    form="checkout-form"
                                    className="btn-place-order"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processing Order...' : 'Complete Purchase'}
                                    <ArrowRight size={18} />
                                </button>

                                <div className="security-badges">
                                    <div className="badge-item">
                                        <ShieldCheck size={14} /> <span>Secure Checkout</span>
                                    </div>
                                    <div className="badge-item">
                                        <Package size={14} /> <span>Quality Inspected</span>
                                    </div>
                                </div>
                            </div>

                            {!user && (
                                <div className="checkout-login-prompt">
                                    <AlertCircle size={20} />
                                    <div>
                                        <p>Checking out as a guest?</p>
                                        <Link to="/login?redirect=/checkout">Login for a faster experience</Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
