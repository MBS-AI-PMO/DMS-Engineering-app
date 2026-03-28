import React, { useEffect } from 'react';
import { CheckCircle, ArrowLeft, Download, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Quote = () => {
  const location = useLocation();
  const { totalPrice, selectedProductionService, selectedMetal } = location.state || {};
  const [referenceId] = React.useState(() =>
    `Q${Math.random().toString(36).substring(2, 8).toUpperCase()}-${new Date().getFullYear()}`
  );

  useEffect(() => {
    document.body.classList.add('light-mode');
    // Clear full-page quote flow styles if they persist
    document.documentElement.classList.remove('qf-active');
    document.body.classList.remove('qf-active');

    return () => {
      document.body.classList.remove('light-mode');
    };
  }, []);

  return (
    <div className="quote-container light-mode fadeIn" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      padding: '40px'
    }}>
      <div className="quote-content slideUp" style={{
        background: 'white',
        padding: '60px',
        borderRadius: '32px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div className="success-icon animate-scale" style={{ marginBottom: '32px' }}>
          <CheckCircle size={80} color="#10b981" />
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Quote Ready</h1>
        <p className="quote-id" style={{ color: '#64748b', fontWeight: '600', marginBottom: '40px' }}>
          Reference: {referenceId}
        </p>

        <div className="quote-details" style={{
          background: '#f8fafc',
          padding: '32px',
          borderRadius: '24px',
          marginBottom: '40px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>Production:</span>
            <strong style={{ color: '#0f172a' }}>{selectedProductionService?.title || 'Custom CAD Part'}</strong>
          </div>
          <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>Material:</span>
            <strong style={{ color: '#0f172a' }}>{selectedMetal?.name || 'Standard Alloy'}</strong>
          </div>
          <div style={{ borderTop: '1px dashed #cbd5e1', margin: '8px 0' }} />
          <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#0f172a', fontWeight: '800', fontSize: '18px' }}>Total Price:</span>
            <strong style={{ color: '#2563eb', fontSize: '28px', fontWeight: '900' }}>
              ${totalPrice ? (parseFloat(totalPrice)).toFixed(2) : '245.00'}
            </strong>
          </div>
        </div>

        <div className="quote-actions" style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <button className="btn-download" style={{
            flex: 1,
            padding: '16px',
            borderRadius: '16px',
            background: '#f1f5f9',
            border: 'none',
            color: '#0f172a',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}>
            <Download size={18} /> PDF
          </button>
          <button className="btn-approve" style={{
            flex: 2,
            padding: '16px',
            borderRadius: '16px',
            background: '#0f172a',
            border: 'none',
            color: 'white',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}>
            <CreditCard size={18} /> Checkout
          </button>
        </div>

        <Link to="/get-instant-pricing" className="back-link" style={{
          color: '#64748b',
          textDecoration: 'none',
          fontWeight: '600',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ArrowLeft size={16} /> Back to Upload
        </Link>
      </div>
    </div>
  );
};

export default Quote;
