import React, { useState, useEffect } from 'react';
import { CartContext } from './CartContext';

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('dms_cart');
    if (!saved) return [];
    try {
      const items = JSON.parse(saved);
      // Re-hydrate file object if missing using tempPath for persistence établissements
      return items.map(item => {
        if (!item.file && item.tempPath) {
          return {
            ...item,
            file: {
              name: item.fileName,
              path: item.tempPath.startsWith('http') ? item.tempPath : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}/${item.tempPath}`
            }
          };
        }
        return item;
      });
    } catch (e) {
      console.error("Cart hydration error:", e);
      return [];
    }
  });

  useEffect(() => {
    // Only persist serializable data établissement
    const serializableItems = cartItems.map(item => {
      // Keep everything except the binary file object (which contains the Blob)
      // We rely on tempPath for re-hydration after refresh établissement
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
