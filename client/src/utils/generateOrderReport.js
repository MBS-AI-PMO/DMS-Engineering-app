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
    doc.roundedRect(margin, y, contentW, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...darkSlate);
    doc.text('ORDER #' + order.id, margin + 8, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...medGrey);
    doc.text('Status: ' + (order.status || 'pending').toUpperCase(), margin + 8, y + 19);
    doc.text('Payment: ' + (order.payment_method || 'COD').toUpperCase(), margin + 8, y + 25);

    doc.setFillColor(...brandRed);
    doc.roundedRect(pageW - margin - 50, y + 4, 45, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text('$' + parseFloat(order.total_price || 0).toFixed(2), pageW - margin - 27.5, y + 18, { align: 'center' });

    y += 40;

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
        const config = typeof item.configuration_json === 'string' ? JSON.parse(item.configuration_json) : (item.configuration_json || {});
        return [
            String(idx + 1),
            item.file_name || 'Unknown',
            config.metal?.name || 'N/A',
            config.thickness ? config.thickness + ' mm' : 'N/A',
            String(item.quantity || 1),
            '$' + parseFloat(item.unit_price || 0).toFixed(2)
        ];
    });

    autoTable(doc, {
        startY: y,
        head: [['#', 'File Name', 'Material', 'Thickness', 'Qty', 'Unit Price']],
        body: itemTableData,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: darkSlate, textColor: white, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 4, textColor: darkSlate, halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 55, halign: 'left' },
            2: { cellWidth: 35 },
            3: { cellWidth: 25 },
            4: { cellWidth: 15 },
            5: { cellWidth: 25 },
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
        const config = typeof item.configuration_json === 'string' ? JSON.parse(item.configuration_json) : (item.configuration_json || {});

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
            ['Finish / Anodizing', config.anodizingColor?.name || config.anodizingColor?.label || 'None'],
            ['Anodizing Color Code', config.anodizingColor?.color || 'N/A'],
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
                if (dims.mm.volume && dims.mm.volume !== '0.00') dimRows.push(['Volume', dims.mm.volume + ' cm3']);
            }
            if (dims.inches) {
                dimRows.push(['Length (in)', dims.inches.l + '"']);
                dimRows.push(['Width (in)', dims.inches.w + '"']);
                dimRows.push(['Thickness (in)', dims.inches.t + '"']);
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
                const pos = hole.position;
                let posStr = 'N/A';
                if (Array.isArray(pos)) posStr = '(' + pos.map(v => parseFloat(v).toFixed(2)).join(', ') + ')';
                else if (pos && typeof pos === 'object') posStr = '(' + parseFloat(pos.x || 0).toFixed(2) + ', ' + parseFloat(pos.y || 0).toFixed(2) + ', ' + parseFloat(pos.z || 0).toFixed(2) + ')';

                return [
                    String(i + 1),
                    tapInfo.tap_name || tapInfo.name || 'Tap ' + tapId,
                    hole.diameterInches ? (hole.diameterInches * 25.4).toFixed(2) + ' mm' : 'N/A',
                    posStr,
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
