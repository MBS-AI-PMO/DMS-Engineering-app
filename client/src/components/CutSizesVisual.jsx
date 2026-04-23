import React from 'react';

const CutSizesVisual = ({ sizes }) => {
    // Helper to extract numerical dimensions from a string like ".25\" x .375\" min"
    const parseSize = (sizeStr) => {
        // Match numbers including decimals
        const matches = sizeStr.match(/(\d*\.?\d+)/g);
        if (matches && matches.length >= 2) {
            return {
                width: parseFloat(matches[0]),
                height: parseFloat(matches[1])
            };
        }
        return { width: 1, height: 1 }; // Fallback
    };

    const parsedSizes = sizes.map(s => ({
        ...s,
        ...parseSize(s.size)
    }));

    // Find the max dimensions across ALL metals or use a standard max
    const maxHeight = 56; // Standard max height (Box C)

    const [containerHeight, setContainerHeight] = React.useState(200);

    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 500) {
                setContainerHeight(130);
            } else if (window.innerWidth < 768) {
                setContainerHeight(160);
            } else {
                setContainerHeight(200);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const MIN_DIM = 20;

    // Global scaling factor
    const scale = (containerHeight - 20) / maxHeight;

    return (
        <div className="cut-sizes-visual">
            {parsedSizes.map((size, index) => {
                // Calculate visual dimensions - true portrait aspect ratio
                let visualWidth = Math.max(MIN_DIM, size.width * scale * 1.5); // Refined multiplier for portrait look
                let visualHeight = Math.max(MIN_DIM, size.height * scale);

                // Special handling for Box A to ensure it's visibly a tiny portrait rectangle
                if (size.label === 'A') {
                    visualWidth = 20;
                    visualHeight = 28;
                }

                return (
                    <div
                        key={index}
                        className={`visual-item visual-${size.label.toLowerCase()} ${size.type === 'outline' ? 'outline' : 'solid'}`}
                        style={{
                            width: `${visualWidth}px`,
                            height: `${visualHeight}px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: size.label === 'A' ? '10px' : '16px'
                        }}
                    >
                        {size.label}
                    </div>
                );
            })}
        </div>
    );
};

export default CutSizesVisual;
