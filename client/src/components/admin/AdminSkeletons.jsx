import React from 'react';
import Skeleton from '../Skeleton';

export const TableRowSkeleton = ({ columns = 5, rows = 5 }) => {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="skeleton-row-animate">
          {[...Array(columns)].map((_, j) => (
            <td key={j}>
              <Skeleton
                variant="text"
                style={{
                  width: j === 0 ? '60%' : '80%',
                  opacity: 0.6 + (Math.random() * 0.4)
                }}
              />
            </td>
          ))}
          <td>
            <div className="table-actions">
              <Skeleton variant="rectangle" style={{ width: '40px', height: '30px' }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
};

export const StatsCardSkeleton = ({ count = 2 }) => {
  return (
    <div className="admin-stats-grid mini">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="admin-stat-card">
          <Skeleton variant="circle" style={{ width: '52px', height: '52px', flexShrink: 0 }} />
          <div className="stat-card-body">
            <Skeleton variant="text" style={{ width: '40px', height: '28px', marginBottom: '8px' }} />
            <Skeleton variant="text" style={{ width: '80px', height: '14px' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const GenericSkeleton = ({ height = '100px', count = 1, className = '' }) => {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <Skeleton
          key={i}
          className={`mb-4 ${className}`}
          style={{ height }}
        />
      ))}
    </>
  );
};

export const MetalRowSkeleton = ({ rows = 5 }) => {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i}>
          <td>
            <div className="table-cell-name">
              <Skeleton variant="rectangle" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
              <div className="name-group">
                <Skeleton variant="text" style={{ width: '120px' }} />
              </div>
            </div>
          </td>
          <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
          <td><Skeleton variant="rectangle" style={{ width: '90px', height: '20px', borderRadius: '20px' }} /></td>
          <td><Skeleton variant="text" style={{ width: '60px' }} /></td>
          <td>
            <div className="table-actions">
              <Skeleton variant="rectangle" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
              <Skeleton variant="rectangle" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
};

export const CustomerRowSkeleton = ({ rows = 5 }) => {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i}>
          <td>
            <div className="customer-name-cell">
              <Skeleton variant="circle" style={{ width: '32px', height: '32px' }} />
              <Skeleton variant="text" style={{ width: '100px' }} />
            </div>
          </td>
          <td><Skeleton variant="text" style={{ width: '150px' }} /></td>
          <td><Skeleton variant="text" style={{ width: '100px' }} /></td>
          <td><Skeleton variant="text" style={{ width: '200px' }} /></td>
          <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
        </tr>
      ))}
    </>
  );
};

export const EmailFormSkeleton = () => {
  return (
    <div className="email-config-card">
      <div className="email-config-icon">
        <Skeleton variant="circle" style={{ width: '64px', height: '64px' }} />
      </div>
      <Skeleton variant="text" style={{ width: '100%', height: '14px', marginBottom: '24px' }} />
      <div className="admin-form-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="admin-form-group">
            <Skeleton variant="text" style={{ width: '100px', marginBottom: '8px' }} />
            <Skeleton variant="rectangle" style={{ width: '100%', height: '40px' }} />
          </div>
        ))}
      </div>
      <div className="email-config-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <Skeleton variant="rectangle" style={{ width: '160px', height: '44px' }} />
        <Skeleton variant="rectangle" style={{ width: '140px', height: '44px' }} />
      </div>
    </div>
  );
};

export const PaymentMethodSkeleton = () => {
  return (
    <div className="payment-methods-grid">
      {/* COD Skeleton */}
      <div className="payment-method-card">
        <div className="payment-method-header">
          <Skeleton variant="circle" style={{ width: '52px', height: '52px' }} />
          <div className="payment-method-info">
            <Skeleton variant="text" style={{ width: '140px', height: '20px', marginBottom: '8px' }} />
            <Skeleton variant="text" style={{ width: '200px', height: '14px' }} />
          </div>
          <div className="payment-method-toggle-wrap">
            <Skeleton variant="rectangle" style={{ width: '44px', height: '24px', borderRadius: '12px' }} />
          </div>
        </div>
      </div>

      {/* PayPal Skeleton */}
      <div className="payment-method-card">
        <div className="payment-method-header">
          <Skeleton variant="circle" style={{ width: '52px', height: '52px' }} />
          <div className="payment-method-info">
            <Skeleton variant="text" style={{ width: '80px', height: '20px', marginBottom: '8px' }} />
            <Skeleton variant="text" style={{ width: '180px', height: '14px' }} />
          </div>
          <div className="payment-method-toggle-wrap">
            <Skeleton variant="rectangle" style={{ width: '44px', height: '24px', borderRadius: '12px' }} />
          </div>
        </div>
        <div className="payment-paypal-body" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <Skeleton variant="rectangle" style={{ width: '100px', height: '32px', borderRadius: '8px' }} />
            <Skeleton variant="rectangle" style={{ width: '80px', height: '32px', borderRadius: '8px' }} />
          </div>
          <div className="admin-form-grid" style={{ gap: '16px' }}>
            <div className="admin-form-group">
               <Skeleton variant="text" style={{ width: '80px', marginBottom: '8px' }} />
               <Skeleton variant="rectangle" style={{ width: '100%', height: '42px' }} />
            </div>
            <div className="admin-form-group">
               <Skeleton variant="text" style={{ width: '60px', marginBottom: '8px' }} />
               <Skeleton variant="rectangle" style={{ width: '100%', height: '42px' }} />
            </div>
          </div>
          <div style={{ marginTop: '24px' }}>
            <Skeleton variant="rectangle" style={{ width: '160px', height: '38px', borderRadius: '8px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};



