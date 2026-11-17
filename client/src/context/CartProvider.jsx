import React, { useState, useEffect } from 'react';
import { CartContext } from './CartContext';
import { calculatePrice, fetchPublicDiscounts } from '../utils/api';
import { trackEvent, cartEventParams } from '../utils/tracking';

const normalizeStoredAssetPath = (value) => {
  let raw = String(value || '').trim();
  if (!raw) return '';

  try {
    if (/^https?:\/\//i.test(raw)) {
      raw = new URL(raw).pathname;
    }
  } catch {
    return raw;
  }

  raw = raw.replace(/^\/+/, '');
  if (raw.startsWith('api/temp_uploads/')) return `/${raw}`;
  if (raw.startsWith('temp_uploads/')) return `/api/${raw}`;
  if (raw.startsWith('api/uploads/')) return `/${raw}`;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  return `/${raw}`;
};

// What a cart line costs: the server's line total when the cart has one.
const lineTotalOf = (item) => {
  const qty = item.quantity || 1;
  const lineTotal = Number(item.pricing?.lineTotal);
  return Number.isFinite(lineTotal) && lineTotal > 0 ? lineTotal : (item.pricing?.total || 0) * qty;
};

/* A cart item after a /pricing/calculate reply for a new quantity: new
 * prices, or "needs a quote" when there is no instant price. */
const withServerPrice = (item, res, quantity, payload) => {
  if (res?.quote_required) {
    return { ...item, isUpdating: false, quoteRequired: true, quoteReasons: res.reasons || [], pricingInput: item.pricingInput ? payload : item.pricingInput };
  }
  // No new price: drop the old line total, which was for the previous
  // quantity; checkout prices the line on the server anyway.
  if (!res?.success) return { ...item, isUpdating: false, pricing: { ...item.pricing, lineTotal: null } };
  const unitFinal = parseFloat(res.breakdown?.final_unit_price || (quantity > 0 ? (parseFloat(res.total_price || 0) / quantity) : 0));
  return {
    ...item,
    isUpdating: false,
    quoteRequired: false,
    quoteReasons: [],
    pricingInput: item.pricingInput ? payload : item.pricingInput,
    pricing: {
      ...item.pricing,
      baseUnit: parseFloat(res.breakdown?.unit_total || 0),
      discount_percent: parseFloat(res.breakdown?.discount_percent || 0),
      total: unitFinal,
      lineTotal: parseFloat(res.total_price || 0) || unitFinal * quantity,
    },
  };
};

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
              path: normalizeStoredAssetPath(item.tempPath)
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
    trackEvent('AddToCart', cartEventParams([item]));
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

  const addManyToCart = (items = []) => {
    if (items.length) trackEvent('AddToCart', cartEventParams(items));
    setCartItems(prev => {
      const now = Date.now();
      const newItems = items.map((item, index) => ({
        ...item,
        cartId: now + index + Math.random(),
        quantity: item.quantity || 1
      }));
      return [...prev, ...newItems];
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

      // Newer cart items carry the exact request that was priced; reuse it.
      if (itemToUpdate.pricingInput) {
        const payload = { ...itemToUpdate.pricingInput, quantity: newQuantity };
        const res = await calculatePrice(payload);
        setCartItems(prev => prev.map(item => (item.cartId === cartId ? withServerPrice(item, res, newQuantity, payload) : item)));
        return;
      }

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
        file_ref: itemToUpdate.tempPath || null,
        thickness_value: normalizedThicknessInches,
        length_in: configuration.dimensions?.inches?.l,
        height_in: configuration.dimensions?.inches?.w,
        quantity: newQuantity,
        additional_services: (configuration.additionalServices || []).map(s => {
          const opt = configuration.selectedFinishColors?.[s.id];
          const options = Array.isArray(s.service_options) ? s.service_options : [];
          const optIndex = opt
            ? options.findIndex(o =>
              (opt.id != null && o.id === opt.id) ||
              (opt.name && o.name === opt.name) ||
              (opt.color && o.color === opt.color)
            )
            : -1;
          return {
            id: s.id,
            option_id: opt?.id ?? opt?.index ?? (optIndex >= 0 ? optIndex : (opt?.name || null))
          };
        }),
        taps: Object.values(configuration.selectedTaps || {}).map(t => ({ name: t.name, price: t.price })),
        hardware: Object.values(configuration.selectedHardware || {}).map(h => ({ id: h?.item?.id ?? null, name: h?.item?.name, price: h?.item?.price || 0 })),
        countersinks: Object.values(configuration.selectedCountersinks || {}).map(cs => ({ name: cs?.name, price: cs?.price || 0 })),
        technical_data: configuration.pricingTechnicalData || {
          totalPerimeter: ((parseFloat(configuration.dimensions?.inches?.l) || 0) + (parseFloat(configuration.dimensions?.inches?.w) || 0)) * 2 * 25.4,
          pierceCount: Math.max(1, (configuration.detectedHoles || []).length || 1),
          bends: []
        }
      };

      const res = await calculatePrice(payload);
      setCartItems(prev => prev.map(item => (item.cartId === cartId ? withServerPrice(item, res, newQuantity, payload) : item)));
    } catch (err) {
      console.error('Failed to recalculate price in cart:', err);
      setCartItems(prev => prev.map(item =>
        item.cartId === cartId ? { ...item, isUpdating: false, pricing: { ...item.pricing, lineTotal: null } } : item
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

  // A line's total is the server's line total when known (it is rounded per
  // line, not per part); parts that need a quote are not counted.
  const cartTotal = cartItems.reduce((sum, item) => {
    if (item.quoteRequired) return sum;
    return sum + lineTotalOf(item);
  }, 0);

  const cartDiscount = cartSubtotal - cartTotal;

  /* Checkout found new prices on the server: [{ index, unitPrice, lineTotal }]. */
  const applyServerPrices = (changed = []) => {
    setCartItems(prev => prev.map((item, index) => {
      const hit = changed.find(c => c.index === index);
      if (!hit) return item;
      return {
        ...item,
        quoteRequired: false,
        pricing: { ...item.pricing, baseUnit: hit.unitPrice, total: hit.unitPrice, lineTotal: hit.lineTotal, discount_percent: 0 },
      };
    }));
  };

  /* Checkout found parts with no instant price: [{ index, reasons }]. */
  const markQuoteRequired = (items = []) => {
    setCartItems(prev => prev.map((item, index) => {
      const hit = items.find(c => c.index === index);
      return hit ? { ...item, quoteRequired: true, quoteReasons: hit.reasons || [] } : item;
    }));
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      allDiscounts,
      addToCart,
      addManyToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartSubtotal,
      cartDiscount,
      applyServerPrices,
      markQuoteRequired
    }}>
      {children}
    </CartContext.Provider>
  );
};
