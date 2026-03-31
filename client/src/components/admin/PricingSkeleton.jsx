import React from 'react';

const SkeletonPulse = ({ className, style }) => (
    <div
        className={`bg-slate-200 animate-pulse rounded-md ${className}`}
        style={{
            backgroundColor: '#e2e8f0',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            ...style
        }}
    />
);

export default function PricingSkeleton() {
    return (
        <div className="pricing-skeleton-container" style={{ padding: '20px' }}>
            {/* Header Skeleton */}
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <SkeletonPulse style={{ width: '250px', height: '32px', marginBottom: '8px' }} />
                    <SkeletonPulse style={{ width: '400px', height: '16px' }} />
                </div>
            </div>

            {/* Volume Discounts Card Skeleton */}
            <div style={{
                background: 'white',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                marginBottom: '48px',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '32px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <SkeletonPulse style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                        <div>
                            <SkeletonPulse style={{ width: '180px', height: '20px', marginBottom: '8px' }} />
                            <SkeletonPulse style={{ width: '300px', height: '14px' }} />
                        </div>
                    </div>
                    <SkeletonPulse style={{ width: '120px', height: '40px', borderRadius: '10px' }} />
                </div>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <SkeletonPulse style={{ width: '60%', height: '20px', margin: '0 auto 20px' }} />
                    <SkeletonPulse style={{ width: '40%', height: '16px', margin: '0 auto' }} />
                </div>
            </div>

            {/* Metal Selection Section Skeleton */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SkeletonPulse style={{ width: '24px', height: '24px' }} />
                <SkeletonPulse style={{ width: '150px', height: '24px' }} />
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px'
            }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px'
                    }}>
                        <SkeletonPulse style={{ width: '60px', height: '60px', borderRadius: '10px' }} />
                        <div style={{ flex: 1 }}>
                            <SkeletonPulse style={{ width: '80%', height: '18px', marginBottom: '8px' }} />
                            <SkeletonPulse style={{ width: '40%', height: '14px' }} />
                        </div>
                        <SkeletonPulse style={{ width: '20px', height: '20px' }} />
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
            `}</style>
        </div>
    );
}
