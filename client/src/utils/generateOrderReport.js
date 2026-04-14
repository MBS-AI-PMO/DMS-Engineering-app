import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Loads an image from a URL and returns it as a base64 data URL.
 */
const loadImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
    });
};

const safeParseConfig = (rawConfig) => {
    if (!rawConfig) return {};
    if (typeof rawConfig === 'object') return rawConfig;
    if (typeof rawConfig === 'string') {
        try {
            return JSON.parse(rawConfig);
        } catch {
            return {};
        }
    }
    return {};
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const formatPosition = (position) => {
    if (Array.isArray(position) && position.length >= 3) {
        return '(' + position.slice(0, 3).map(v => (toNumber(v) ?? 0).toFixed(2)).join(', ') + ')';
    }
    if (position && typeof position === 'object') {
        return '('
            + (toNumber(position.x) ?? 0).toFixed(2) + ', '
            + (toNumber(position.y) ?? 0).toFixed(2) + ', '
            + (toNumber(position.z) ?? 0).toFixed(2) + ')';
    }
    return 'N/A';
};

const formatDiameter = (inches) => {
    const valueInches = toNumber(inches);
    if (valueInches === null) return 'N/A';
    return valueInches.toFixed(4) + ' in (' + (valueInches * 25.4).toFixed(2) + ' mm)';
};

const getConfigCounts = (config) => {
    const selectedBends = config?.selectedBends || {};
    const detectedBends = config?.detectedBends || [];
    return {
        services: Array.isArray(config?.additionalServices) ? config.additionalServices.length : 0,
        taps: Object.keys(config?.selectedTaps || {}).length,
        hardware: Object.keys(config?.selectedHardware || {}).length,
        countersinks: Object.keys(config?.selectedCountersinks || {}).length,
        bends: Math.max(Object.keys(selectedBends).length, Array.isArray(detectedBends) ? detectedBends.length : 0),
    };
};

const getAppliedServices = (config) => {
    const services = Array.isArray(config?.additionalServices) ? config.additionalServices : [];
    const finishByService = config?.selectedFinishColors || {};
    return services.map(service => {
        const selectedFinish = finishByService[service.id];
        const finishLabel = selectedFinish?.name || selectedFinish?.service_name || selectedFinish?.service || '';
        return finishLabel ? (service.title + ': ' + finishLabel) : service.title;
    });
};

/**
 * Generates a premium PDF report for a manufacturing order.
 */
export async function generateOrderReport(order, items) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageW - margin * 2;

    const brandRed = [227, 27, 35];
    const darkSlate = [15, 23, 42];
    const medGrey = [100, 116, 139];
    const lightGrey = [241, 245, 249];
    const white = [255, 255, 255];

    let logoData = null;
    try {
        logoData = await loadImageAsBase64('/logo.png');
    } catch (e) {
        console.warn('Could not load logo for PDF watermark', e);
    }

    const drawWatermarks = () => {
        if (!logoData) return;
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.04 }));
        for (let wy = 30; wy < pageH; wy += 80) {
            for (let wx = -20; wx < pageW; wx += 90) {
                doc.addImage(logoData, 'PNG', wx, wy, 60, 25);
            }
        }
        doc.restoreGraphicsState();
    };

    const drawFooter = (pageNum, totalPages) => {
        const footerY = pageH - 10;
        doc.setFontSize(7);
        doc.setTextColor(...medGrey);
        doc.text('Dynamic Manufacturing Solutions  •  Confidential Manufacturing Report', margin, footerY);
        doc.text('Page ' + pageNum + ' of ' + totalPages, pageW - margin, footerY, { align: 'right' });
        doc.setDrawColor(...brandRed);
        doc.setLineWidth(0.3);
        doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
    };

    // ═══ PAGE 1: COVER ═══
    drawWatermarks();

    doc.setFillColor(...darkSlate);
    doc.rect(0, 0, pageW, 62, 'F');
    if (logoData) doc.addImage(logoData, 'PNG', margin, 6, 36, 15);

    doc.setFontSize(8);
    doc.setTextColor(180, 190, 210);
    doc.text('Report Generated: ' + new Date().toLocaleString(), pageW - margin, 12, { align: 'right' });
    doc.text('Document ID: MFG-' + order.id + '-' + Date.now().toString(36).toUpperCase(), pageW - margin, 18, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...white);
    doc.text('MANUFACTURING ORDER REPORT', pageW / 2, 42, { align: 'center' });

    // ── Red accent stripe ──
    doc.setFillColor(...brandRed);
    doc.rect(0, 62, pageW, 3, 'F');

    let y = 65;

    // Order summary box
    doc.setFillColor(...lightGrey);
    doc.roundedRect(margin, y, contentW, 36, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...darkSlate);
    doc.text('ORDER #' + order.id, margin + 8, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...medGrey);
    doc.text('Status: ' + (order.status || 'pending').toUpperCase(), margin + 8, y + 19);
    doc.text('Payment: ' + (order.payment_method || 'COD').toUpperCase(), margin + 8, y + 25);
    if (order.payment_id) {
        doc.text('Payment Ref: ' + String(order.payment_id), margin + 8, y + 31);
    }

    doc.setFillColor(...brandRed);
    doc.roundedRect(pageW - margin - 50, y + 4, 45, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text('$' + parseFloat(order.total_price || 0).toFixed(2), pageW - margin - 27.5, y + 18, { align: 'center' });

    y += 46;

    // Customer Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brandRed);
    doc.text('CUSTOMER INFORMATION', margin, y);
    y += 2;
    doc.setDrawColor(...brandRed);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 60, y);
    y += 7;

    const customerData = [
        ['Full Name', order.full_name || 'N/A'],
        ['Email', order.email || 'N/A'],
        ['Phone', order.phone || 'N/A'],
        ['Address', order.address || 'N/A'],
        ['City', order.city || 'N/A'],
        ['ZIP / Postal Code', order.zip_code || 'N/A'],
        ['Order Date', order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'],
    ];

    autoTable(doc, {
        startY: y,
        body: customerData,
        theme: 'plain',
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3, textColor: darkSlate },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 45, textColor: medGrey },
            1: { cellWidth: contentW - 45 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    y = doc.lastAutoTable.finalY + 12;

    // Items overview
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brandRed);
    doc.text('ORDER ITEMS OVERVIEW', margin, y);
    y += 2;
    doc.line(margin, y, margin + 55, y);
    y += 5;

    const itemTableData = items.map((item, idx) => {
        const config = safeParseConfig(item.configuration_json);
        const counts = getConfigCounts(config);
        const featureBits = [];
        if (counts.services > 0) featureBits.push('Services: ' + counts.services);
        if (counts.taps > 0) featureBits.push('Taps: ' + counts.taps);
        if (counts.hardware > 0) featureBits.push('Hardware: ' + counts.hardware);
        if (counts.countersinks > 0) featureBits.push('Countersinks: ' + counts.countersinks);
        if (counts.bends > 0) featureBits.push('Bends: ' + counts.bends);

        return [
            String(idx + 1),
            item.file_name || 'Unknown',
            config.metal?.name || 'N/A',
            config.thickness ? config.thickness + ' mm' : 'N/A',
            String(item.quantity || 1),
            '$' + parseFloat(item.unit_price || 0).toFixed(2),
            featureBits.length > 0 ? featureBits.join(' | ') : 'None'
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['#', 'File Name', 'Material', 'Thickness', 'Qty', 'Unit Price', 'Applied Features']],
        body: itemTableData,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 4, textColor: darkSlate, halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 44, halign: 'left' },
            2: { cellWidth: 27 },
            3: { cellWidth: 18 },
            4: { cellWidth: 12 },
            5: { cellWidth: 20 },
            6: { cellWidth: 45, halign: 'left' },
        }
    });

    // ═══ PAGE 2+: PER-ITEM DETAIL ═══
    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        doc.addPage();
        drawWatermarks();

        doc.setFillColor(...darkSlate);
        doc.rect(0, 0, pageW, 20, 'F');
        if (logoData) doc.addImage(logoData, 'PNG', margin, 3, 30, 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...white);
        doc.text('ORDER #' + order.id + '  •  ITEM ' + (idx + 1) + ' of ' + items.length, pageW - margin, 13, { align: 'right' });
        doc.setFillColor(...brandRed);
        doc.rect(0, 20, pageW, 2, 'F');

        let iy = 32;
        const config = safeParseConfig(item.configuration_json);
        const counts = getConfigCounts(config);
        const appliedServices = getAppliedServices(config);
        const finishNames = [
            config.anodizingColor?.name || config.anodizingColor?.label || null,
            ...Object.values(config.selectedFinishColors || {}).map(v => v?.name || v?.service_name || v?.service || null)
        ].filter(Boolean);
        const uniqueFinishNames = [...new Set(finishNames)];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...darkSlate);
        doc.text(item.file_name || 'Unknown Part', margin, iy);
        iy += 8;

        // Configuration
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...brandRed);
        doc.text('MANUFACTURING CONFIGURATION', margin, iy);
        iy += 2;
        doc.setLineWidth(0.4);
        doc.setDrawColor(...brandRed);
        doc.line(margin, iy, margin + 65, iy);
        iy += 5;

        const configRows = [
            ['Production Service', config.productionService?.title || config.productionService?.name || 'N/A'],
            ['Material / Alloy', config.metal?.name || 'N/A'],
            ['Material Thickness', config.thickness ? config.thickness + ' mm' : 'N/A'],
            ['Selected Stock Thickness', config.selectedThickness ? String(config.selectedThickness) : 'N/A'],
            ['Finish / Anodizing', config.anodizingColor?.name || config.anodizingColor?.label || 'None'],
            ['Anodizing Color Code', config.anodizingColor?.color || 'N/A'],
            ['Applied Services', appliedServices.length > 0 ? appliedServices.join(', ') : 'None'],
            ['Finish Options', uniqueFinishNames.length > 0 ? uniqueFinishNames.join(', ') : 'None'],
            ['Tapped Holes', String(counts.taps)],
            ['Hardware Inserts', String(counts.hardware)],
            ['Countersinks', String(counts.countersinks)],
            ['Detected Bends', String(counts.bends)],
            ['Quantity Ordered', (item.quantity || 1) + ' unit(s)'],
            ['Unit Price', '$' + parseFloat(item.unit_price || 0).toFixed(2)],
            ['Subtotal', '$' + (parseFloat(item.unit_price || 0) * (item.quantity || 1)).toFixed(2)],
        ];

        autoTable(doc, {
            startY: iy,
            body: configRows,
            theme: 'plain',
            margin: { left: margin, right: margin },
            styles: { fontSize: 9, cellPadding: 3.5, textColor: darkSlate },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50, textColor: medGrey },
                1: { cellWidth: contentW - 50 }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        iy = doc.lastAutoTable.finalY + 10;

        // Dimensions
        if (config.dimensions) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...brandRed);
            doc.text('PART DIMENSIONS', margin, iy);
            iy += 2;
            doc.line(margin, iy, margin + 40, iy);
            iy += 5;

            const dims = config.dimensions;
            const dimRows = [];
            if (dims.mm) {
                dimRows.push(['Length (mm)', dims.mm.l + ' mm']);
                dimRows.push(['Width (mm)', dims.mm.w + ' mm']);
                dimRows.push(['Thickness (mm)', dims.mm.t + ' mm']);
                if (dims.mm.volume && dims.mm.volume !== '0.00') dimRows.push(['Volume (mm^3)', dims.mm.volume + ' mm^3']);
            }
            if (dims.inches) {
                dimRows.push(['Length (in)', dims.inches.l + '"']);
                dimRows.push(['Width (in)', dims.inches.w + '"']);
                dimRows.push(['Thickness (in)', dims.inches.t + '"']);
                if (dims.inches.volume && dims.inches.volume !== '0.000') dimRows.push(['Volume (in^3)', dims.inches.volume + ' in^3']);
            }

            if (dimRows.length > 0) {
                autoTable(doc, {
                    startY: iy,
                    body: dimRows,
                    theme: 'plain',
                    margin: { left: margin, right: margin },
                    styles: { fontSize: 9, cellPadding: 3, textColor: darkSlate },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: 50, textColor: medGrey },
                        1: { cellWidth: contentW - 50 }
                    },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });
                iy = doc.lastAutoTable.finalY + 10;
            }
        }

        // Tapping
        const taps = config.selectedTaps || {};
        const tapEntries = Object.entries(taps);
        if (tapEntries.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...brandRed);
            doc.text('TAPPING SPECIFICATIONS', margin, iy);
            iy += 2;
            doc.line(margin, iy, margin + 55, iy);
            iy += 5;

            const tapRows = tapEntries.map(([tapId, tapInfo], i) => {
                const hole = tapInfo.hole || {};
                const holeDiameterMm = toNumber(hole.diameter_mm)
                    ?? (toNumber(hole.diameter_in) !== null ? toNumber(hole.diameter_in) * 25.4 : null)
                    ?? (toNumber(hole.diameterInches) !== null ? toNumber(hole.diameterInches) * 25.4 : null);

                return [
                    String(i + 1),
                    tapInfo.tap_name || tapInfo.name || 'Tap ' + tapId,
                    holeDiameterMm !== null ? holeDiameterMm.toFixed(2) + ' mm' : 'N/A',
                    formatPosition(hole.position),
                    tapInfo.price ? '$' + parseFloat(tapInfo.price).toFixed(2) : '$0.00'
                ];
            });

            autoTable(doc, {
                startY: iy,
                head: [['#', 'Tap Type', 'Hole Diameter', 'Position (x, y, z)', 'Price']],
                body: tapRows,
                margin: { left: margin, right: margin },
                headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, cellPadding: 3.5, textColor: darkSlate, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 55, halign: 'left' },
                    4: { cellWidth: 25 },
                }
            });
            iy = doc.lastAutoTable.finalY + 10;
        }

        // Hardware
        const hardware = config.selectedHardware || {};
        const hwEntries = Object.entries(hardware);
        if (hwEntries.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...brandRed);
            doc.text('HARDWARE SPECIFICATIONS', margin, iy);
            iy += 2;
            doc.line(margin, iy, margin + 55, iy);
            iy += 5;

            const hwRows = hwEntries.map(([holeId, hwInfo], i) => {
                const hole = hwInfo.hole || {};
                const item = hwInfo.item || {};

                return [
                    String(i + 1),
                    item.name || 'Hardware ' + holeId,
                    hwInfo.face === 'up' ? 'Top' : 'Bottom',
                    formatPosition(hole.position),
                    item.price ? '$' + parseFloat(item.price).toFixed(2) : '$0.00'
                ];
            });

            autoTable(doc, {
                startY: iy,
                head: [['#', 'Hardware Name', 'Installation Face', 'Position (x, y, z)', 'Price']],
                body: hwRows,
                margin: { left: margin, right: margin },
                headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, cellPadding: 3.5, textColor: darkSlate, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 50, halign: 'left' },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 45, halign: 'left' },
                    4: { cellWidth: 25 },
                }
            });
            iy = doc.lastAutoTable.finalY + 10;
        }

        // Countersinks
        const countersinks = config.selectedCountersinks || {};
        const csEntries = Object.entries(countersinks);
        if (csEntries.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...brandRed);
            doc.text('COUNTERSINK SPECIFICATIONS', margin, iy);
            iy += 2;
            doc.line(margin, iy, margin + 65, iy);
            iy += 5;

            const csRows = csEntries.map(([holeId, csInfo], i) => {
                const hole = csInfo.hole || {};
                return [
                    String(i + 1),
                    csInfo.name || 'Countersink ' + holeId,
                    csInfo.face === 'up' ? 'Top' : (csInfo.face === 'down' ? 'Bottom' : 'N/A'),
                    formatDiameter(csInfo.major_dia),
                    formatDiameter(csInfo.minor_dia),
                    formatPosition(hole.position),
                    csInfo.price ? '$' + parseFloat(csInfo.price).toFixed(2) : '$0.00'
                ];
            });

            autoTable(doc, {
                startY: iy,
                head: [['#', 'Countersink', 'Face', 'Major Diameter', 'Minor Diameter', 'Position (x, y, z)', 'Price']],
                body: csRows,
                margin: { left: margin, right: margin },
                headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, cellPadding: 3.5, textColor: darkSlate, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 35, halign: 'left' },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 24 },
                    4: { cellWidth: 24 },
                    5: { cellWidth: 47, halign: 'left' },
                    6: { cellWidth: 20 },
                }
            });
            iy = doc.lastAutoTable.finalY + 10;
        }

        // Bending
        const selectedBends = config.selectedBends || {};
        const bendEntries = Object.keys(selectedBends).length > 0
            ? Object.values(selectedBends)
            : (Array.isArray(config.detectedBends) ? config.detectedBends : []);

        if (bendEntries.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...brandRed);
            doc.text('BENDING SPECIFICATIONS', margin, iy);
            iy += 2;
            doc.line(margin, iy, margin + 55, iy);
            iy += 5;

            const bendRows = bendEntries.map((bend, i) => {
                const angleValue = toNumber(bend?.angle) ?? toNumber(bend?.included_angle) ?? toNumber(bend?.initialAngle);
                const radiusValue = toNumber(bend?.radius) ?? toNumber(bend?.r);
                const lineText = (Array.isArray(bend?.p0) && Array.isArray(bend?.p1))
                    ? (formatPosition(bend.p0) + ' -> ' + formatPosition(bend.p1))
                    : (bend?.id ? ('Bend ' + bend.id) : 'Detected bend');

                return [
                    String(i + 1),
                    angleValue !== null ? angleValue.toFixed(2) + ' deg' : 'N/A',
                    radiusValue !== null ? radiusValue.toFixed(2) + ' mm' : 'N/A',
                    lineText
                ];
            });

            autoTable(doc, {
                startY: iy,
                head: [['#', 'Angle', 'Radius', 'Bend Line']],
                body: bendRows,
                margin: { left: margin, right: margin },
                headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, cellPadding: 3.5, textColor: darkSlate, halign: 'center' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 111, halign: 'left' },
                }
            });
            iy = doc.lastAutoTable.finalY + 10;
        }

        // File paths
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...brandRed);
        doc.text('MANUFACTURING FILES', margin, iy);
        iy += 2;
        doc.line(margin, iy, margin + 50, iy);
        iy += 5;

        autoTable(doc, {
            startY: iy,
            body: [
                ['Original Source', item.original_file_path || 'Not available'],
                ['Configured STEP', item.configured_file_path || 'Processing...'],
                ['Flat Pattern DXF', item.flat_file_path || 'Not generated'],
            ],
            theme: 'plain',
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 3, textColor: darkSlate },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40, textColor: medGrey },
                1: { cellWidth: contentW - 40, fontSize: 7 }
            },
        });
    }

    // Page numbers
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
    }

    doc.save('DMS_Order_' + order.id + '_Report.pdf');
}
