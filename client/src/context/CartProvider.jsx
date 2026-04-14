import React, { useState, useEffect } from 'react';
import { CartContext } from './CartContext';
import { calculatePrice, fetchPublicDiscounts } from '../utils/api';

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('dms_cart');
    if (!saved) return [];
    try {
      const items = JSON.parse(saved);
      if (!Array.isArray(items)) return [];

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

  const [allDiscounts, setAllDiscounts] = useState([]);

  useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const discounts = await fetchPublicDiscounts();
        setAllDiscounts(discounts || []);
      } catch (err) {
        console.error('Failed to load discounts in CartProvider:', err);
      }
    };
    loadDiscounts();
  }, []);

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

  const updateQuantity = async (cartId, quantity) => {
    const newQuantity = Math.max(1, quantity);

    // 1. Update quantity and set loading state immediately établissements
    setCartItems(prev => prev.map(item =>
      item.cartId === cartId ? { ...item, quantity: newQuantity, isUpdating: true } : item
    ));

    // 2. Fetch new pricing based on updated quantity établissements
    try {
      const itemToUpdate = cartItems.find(item => item.cartId === cartId);
      if (!itemToUpdate) return;

      const { configuration } = itemToUpdate;
      const isCNC = configuration.productionService?.title?.toLowerCase()?.includes('cnc');
      const normalizedThicknessInches = (() => {
        if (isCNC) return configuration.dimensions?.inches?.t;
        const selectedThickness = configuration.selectedThickness;
        const tObj = (configuration.metal?.quick_look?.thicknesses || []).find(th => String(th.value) === String(selectedThickness));
        if (!tObj) return selectedThickness;
        return tObj.metric === 'mm' ? (parseFloat(tObj.value) / 25.4).toString() : tObj.value;
      })();

      const payload = {
        metal_id: configuration.metal?.id,
        service_id: configuration.productionService?.id,
        thickness_value: normalizedThicknessInches,
        length_in: configuration.dimensions?.inches?.l,
        height_in: configuration.dimensions?.inches?.w,
        quantity: newQuantity,
        additional_services: (configuration.additionalServices || []).map(s => ({
          id: s.id,
          option_id: configuration.selectedFinishColors?.[s.id]?.id || null
        })),
        taps: Object.values(configuration.selectedTaps || {}).map(t => ({ name: t.name, price: t.price })),
        hardware: Object.values(configuration.selectedHardware || {}).map(h => ({ name: h?.item?.name, price: h?.item?.price || 0 })),
        countersinks: Object.values(configuration.selectedCountersinks || {}).map(cs => ({ name: cs?.name, price: cs?.price || 0 })),
        technical_data: configuration.pricingTechnicalData || {
          totalPerimeter: ((parseFloat(configuration.dimensions?.inches?.l) || 0) + (parseFloat(configuration.dimensions?.inches?.w) || 0)) * 2 * 25.4,
          pierceCount: Math.max(1, (configuration.detectedHoles || []).length || 1),
          bends: []
        }
      };

      const res = await calculatePrice(payload);

      if (res.success) {
        const unitBase = parseFloat(res.breakdown?.unit_total || 0);
        const unitFinal = parseFloat(
          res.breakdown?.final_unit_price ||
          (newQuantity > 0 ? (parseFloat(res.total_price || 0) / newQuantity) : 0)
        );
        const discountPercent = parseFloat(res.breakdown?.discount_percent || 0);

        setCartItems(prev => prev.map(item =>
          item.cartId === cartId
            ? {
              ...item,
              pricing: {
                ...item.pricing,
                baseUnit: unitBase,
                discount_percent: discountPercent,
                total: unitFinal
              },
              isUpdating: false
            }
            : item
        ));
      } else {
        setCartItems(prev => prev.map(item =>
          item.cartId === cartId ? { ...item, isUpdating: false } : item
        ));
      }
    } catch (err) {
      console.error('Failed to recalculate price in cart:', err);
      setCartItems(prev => prev.map(item =>
        item.cartId === cartId ? { ...item, isUpdating: false } : item
      ));
    }
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('dms_cart');
  };

  const cartSubtotal = cartItems.reduce((sum, item) => {
    // Gross Subtotal is anchored to the Qty 1 unit price établissements
    const basePrice = item.pricing?.baseUnit || item.pricing?.total || 0;
    return sum + (basePrice * (item.quantity || 1));
  }, 0);

  const cartTotal = cartItems.reduce((sum, item) => {
    const finalPrice = item.pricing?.total || 0;
    return sum + (finalPrice * (item.quantity || 1));
  }, 0);

  const cartDiscount = cartSubtotal - cartTotal;

  return (
    <CartContext.Provider value={{
      cartItems,
      allDiscounts,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartSubtotal,
      cartDiscount
    }}>
      {children}
    </CartContext.Provider>
  );
};
