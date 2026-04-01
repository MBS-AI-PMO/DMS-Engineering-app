import React, { useState, useEffect } from 'react';
import { CartContext } from './CartContext';

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('dms_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // Only persist serializable data
    const serializableItems = cartItems.map(item => {
      const { file: _, ...serializable } = item;
      return serializable;
    });
    localStorage.setItem('dms_cart', JSON.stringify(serializableItems));
  }, [cartItems]);

  const addToCart = (item) => {
    // item: { id, fileName, file, tempPath, configuration, pricing, quantity: 1 }
    setCartItems(prev => {
      // Prevent duplicate cartId issues
      const newItem = {
        ...item,
        cartId: Date.now() + Math.random(),
        quantity: item.quantity || 1
      };
      return [...prev, newItem];
    });
  };

  const removeFromCart = (cartId) => {
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId, quantity) => {
    setCartItems(prev => prev.map(item =>
      item.cartId === cartId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('dms_cart');
  };

  const cartTotal = cartItems.reduce((sum, item) => {
    const unitPrice = item.pricing?.total || item.unitPrice || 0; // High-fidelity price guard établissement
    return sum + (unitPrice * (item.quantity || 1));
  }, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
};
