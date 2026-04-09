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

      const payload = {
        metal_id: configuration.metal?.id,
        service_id: configuration.productionService?.id,
        thickness_value: isCNC ? configuration.dimensions?.inches?.t : configuration.selectedThickness,
        length_in: configuration.dimensions?.inches?.l,
        height_in: configuration.dimensions?.inches?.w,
        quantity: newQuantity,
        additional_services: (configuration.additionalServices || []).map(s => ({
          id: s.id,
          option_id: configuration.selectedFinishColors?.[s.id]?.id || null
        })),
        taps: Object.values(configuration.selectedTaps || {}).map(t => ({ name: t.name, price: t.price }))
      };

      const res = await calculatePrice(payload);

      if (res.success) {
        // res.total_price already includes anodizing (sent via additional_services to the API)
        // Calculate non-engine costs (taps and hardware) to add to the base unit établissements
        const totalTaps = Object.values(configuration.selectedTaps || {}).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0);
        const totalHardware = Object.values(configuration.selectedHardware || {}).reduce((acc, { item }) => acc + (parseFloat(item?.price) || 0), 0);
        const nonEngineUnitCost = (totalTaps + totalHardware) / newQuantity;

        const engineBase = parseFloat(res.breakdown?.unit_total || 0);

        setCartItems(prev => prev.map(item =>
          item.cartId === cartId
            ? {
              ...item,
              pricing: {
                ...item.pricing,
                // Keep original Qty 1 baseUnit, or establish a new anchored base if missing
                baseUnit: item.pricing.baseUnit || (engineBase + nonEngineUnitCost),
                discount_percent: parseFloat(res.breakdown?.discount_percent || 0),
                // Apply Linear Pricing: AnchoredBase * (1 - VolumeDiscount)
                total: (item.pricing.baseUnit || (engineBase + nonEngineUnitCost)) * (1 - (parseFloat(res.breakdown?.discount_percent || 0) / 100))
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
