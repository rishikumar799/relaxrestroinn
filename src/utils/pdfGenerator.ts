import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bill, HotelSettings } from '../types';
import { formatINR } from './currency';
import { formatDateForDisplay } from './date';

/**
 * Generates an official, print-ready, selectable-text A4 Tax Invoice PDF
 * directly from the immutable Bill snapshot stored in Firestore.
 */
export function generateBillPDF(bill: Bill, settings?: HotelSettings): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const hotelName = bill.authorizedBy || settings?.hotelName || 'RELAX RESTO INN';
  const legalName = settings?.legalName || 'Ashritha Sai Services & Trading Pvt Ltd';
  const cin = settings?.cin || 'U55101AP2017PTC106720';
  const address = settings?.address || '#49-49-7, SHANTHIPURAM, VISAKHAPATNAM-530016';
  const phone = settings?.phone || '8125555679';
  const email = settings?.email || 'relaxrestoinn@gmail.com';
  const gstin = settings?.gstin || '37AAWCA2881J2ZY';
  const stateCode = bill.stateCode || settings?.stateCode || '37';
  const placeOfSupply = bill.placeOfSupply || settings?.placeOfSupply || 'ANDHRA PRADESH (37)';

  const pageWidth = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  // 1. Outer Border
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentWidth, 273);

  // 2. Header Box
  doc.setFillColor(250, 248, 245);
  doc.rect(margin, margin, contentWidth, 28, 'F');
  doc.line(margin, margin + 28, margin + contentWidth, margin + 28);

  // Legal & Hotel Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(180, 50, 20); // Warm accent
  doc.text(hotelName.toUpperCase(), pageWidth / 2, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(legalName, pageWidth / 2, y + 11, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`${address} | Ph: ${phone} | Email: ${email}`, pageWidth / 2, y + 16, { align: 'center' });
  doc.text(`GSTIN: ${gstin} | CIN: ${cin} | State Code: ${stateCode}`, pageWidth / 2, y + 21, { align: 'center' });

  y += 28;

  // 3. Tax Invoice Title Bar
  doc.setFillColor(30, 30, 30);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE / BILL OF SUPPLY', pageWidth / 2, y + 4.5, { align: 'center' });

  y += 6.5;

  // 4. Two-column Metadata: Left (Billed To), Right (Invoice & Stay Details)
  const metaHeight = 38;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, metaHeight);
  doc.line(margin + contentWidth / 2, y, margin + contentWidth / 2, y + metaHeight);
  doc.line(margin, y + metaHeight, margin + contentWidth, y + metaHeight);

  // LEFT COLUMN: Guest & Company Info
  const leftX = margin + 3;
  let leftY = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 50, 20);
  doc.text('BILLED TO (GUEST DETAILS):', leftX, leftY);
  leftY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(bill.guestName || 'GUEST', leftX, leftY);
  leftY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  if (bill.guestPhone) {
    doc.text(`Phone: ${bill.guestPhone}`, leftX, leftY);
    leftY += 3.5;
  }
  if (bill.guestAddress) {
    const splitAddr = doc.splitTextToSize(`Address: ${bill.guestAddress}`, (contentWidth / 2) - 6);
    doc.text(splitAddr, leftX, leftY);
    leftY += (splitAddr.length * 3.5);
  }
  if (bill.idCardNumber) {
    doc.text(`ID: ${bill.idCardType || 'ID'} - ${bill.idCardNumber}`, leftX, leftY);
    leftY += 3.5;
  }
  if (bill.companyName || bill.companyDetails) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Company: ${bill.companyName || bill.companyDetails}`, leftX, leftY);
    leftY += 3.5;
  }
  if (bill.companyGSTIN) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Company GSTIN: ${bill.companyGSTIN}`, leftX, leftY);
    leftY += 3.5;
  }

  // RIGHT COLUMN: Invoice, Dates & Room Info
  const rightX = margin + contentWidth / 2 + 3;
  let rightY = y + 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 50, 20);
  doc.text('INVOICE & STAY DETAILS:', rightX, rightY);
  rightY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 30, 30);

  const printKV = (k: string, v: string, rx: number, ry: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k, rx, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(v, rx + 28, ry);
  };

  printKV('Invoice No:', bill.billNo || bill.billId, rightX, rightY); rightY += 3.8;
  printKV('Invoice Date:', `${bill.billDate || ''} ${bill.billTime || ''}`, rightX, rightY); rightY += 3.8;
  printKV('Room Number:', `${bill.roomNumber} (${bill.roomType || 'Executive Room'})`, rightX, rightY); rightY += 3.8;
  printKV('Plan / PAX:', `${bill.planType || 'EP'} | Adult: ${bill.paxAdult || 1}, Child: ${bill.paxChild || 0}`, rightX, rightY); rightY += 3.8;
  printKV('Check-In:', `${bill.checkInDate || ''} ${bill.checkInTime || ''}`, rightX, rightY); rightY += 3.8;
  printKV('Check-Out:', `${bill.checkOutDate || ''} ${bill.checkOutTime || ''}`, rightX, rightY); rightY += 3.8;
  printKV('Days / Period:', `${bill.numberOfDays || 1} Day(s) ${bill.checkInDate === bill.checkOutDate ? '(Same-Day Stay)' : ''}`, rightX, rightY); rightY += 3.8;
  printKV('Place of Supply:', placeOfSupply, rightX, rightY);

  y += metaHeight;

  // 5. Line Items Table (using autoTable)
  const lineItemRows = (bill.lineItems || []).map((item, idx) => {
    const qty = item.numberOfDays !== undefined && item.numberOfDays !== '-' ? String(item.numberOfDays) : '1';
    const rateVal = item.rate || 0;
    const grossVal = item.value || (rateVal * (typeof item.numberOfDays === 'number' ? item.numberOfDays : 1));
    const discVal = item.discount || 0;
    const taxableVal = item.total || (grossVal - discVal);
    const taxRate = item.gstRate !== undefined ? item.gstRate : 12;
    const taxAmount = item.gstAmount !== undefined ? item.gstAmount : (taxableVal * taxRate) / 100;
    const netTotalVal = item.netTotal || (taxableVal + taxAmount);

    return [
      idx + 1,
      item.description || 'TARIFF',
      item.hsn || '996311',
      formatINR(rateVal),
      qty,
      formatINR(grossVal),
      discVal ? formatINR(discVal) : '0.00',
      formatINR(taxableVal),
      `${taxRate}%`,
      formatINR(taxAmount),
      formatINR(netTotalVal),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'S.No', 'Description', 'HSN/SAC', 'Rate', 'Days/Qty', 'Amount', 'Disc.', 'Taxable', 'GST %', 'GST Amt', 'Total (INR)'
    ]],
    body: lineItemRows.length > 0 ? lineItemRows : [[
      '1', 'TARIFF CHARGES', '996311', formatINR(bill.subtotal), String(bill.numberOfDays || 1), formatINR(bill.subtotal), '0.00', formatINR(bill.taxableAmount || bill.subtotal), '12%', formatINR(bill.totalGST), formatINR(bill.grossTotal)
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 38 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'right', cellWidth: 16 },
      10: { halign: 'right', cellWidth: 18 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // 6. GST Tax Summary Table & Payments / Totals side by side
  const startSplitY = y;
  const halfWidth = (contentWidth - 4) / 2;

  // LEFT SIDE: Tax Breakdown Table & Payment Receipts
  const taxRows = (bill.taxSummary && bill.taxSummary.length > 0)
    ? bill.taxSummary.map(t => {
        const taxableVal = t.taxableAmount !== undefined ? t.taxableAmount : (t.taxable || 0);
        const rateVal = t.taxRate !== undefined ? t.taxRate : (t.rate || 12);
        const totalTaxVal = t.taxAmount !== undefined ? t.taxAmount : (t.totalTax || 0);
        const cgstVal = t.cgst !== undefined ? t.cgst : (bill.isInterState ? 0 : totalTaxVal / 2);
        const sgstVal = t.sgst !== undefined ? t.sgst : (bill.isInterState ? 0 : totalTaxVal / 2);
        const igstVal = t.igst !== undefined ? t.igst : (bill.isInterState ? totalTaxVal : 0);

        return [
          t.hsn || '996311',
          formatINR(taxableVal),
          bill.isInterState ? '-' : `${rateVal / 2}% (${formatINR(cgstVal)})`,
          bill.isInterState ? '-' : `${rateVal / 2}% (${formatINR(sgstVal)})`,
          bill.isInterState ? `${rateVal}% (${formatINR(igstVal)})` : '-',
          formatINR(totalTaxVal),
        ];
      })
    : [[
        '996311',
        formatINR(bill.taxableAmount || bill.subtotal),
        bill.isInterState ? '-' : `6% (${formatINR(bill.cgst || bill.totalGST / 2)})`,
        bill.isInterState ? '-' : `6% (${formatINR(bill.sgst || bill.totalGST / 2)})`,
        bill.isInterState ? `12% (${formatINR(bill.igst || bill.totalGST)})` : '-',
        formatINR(bill.totalGST),
      ]];

  autoTable(doc, {
    startY: startSplitY,
    margin: { left: margin, right: margin + halfWidth + 4 },
    head: [['HSN/SAC', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax']],
    body: taxRows,
    theme: 'grid',
    headStyles: {
      fillColor: [70, 70, 70],
      textColor: [255, 255, 255],
      fontSize: 6.5,
      halign: 'center',
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      halign: 'center',
    },
  });

  const leftFinalY = (doc as any).lastAutoTable.finalY + 2;

  // Advance / Payment details under tax summary if any
  if (bill.advanceDetails && bill.advanceDetails.length > 0) {
    const payRows = bill.advanceDetails.map(p => [
      p.date || bill.billDate,
      p.description || p.desc || 'Payment',
      p.refNo || '-',
      formatINR(p.amount),
    ]);

    autoTable(doc, {
      startY: leftFinalY,
      margin: { left: margin, right: margin + halfWidth + 4 },
      head: [['Date', 'Payment Mode', 'Ref No.', 'Amount']],
      body: payRows,
      theme: 'grid',
      headStyles: {
        fillColor: [100, 100, 100],
        textColor: [255, 255, 255],
        fontSize: 6.5,
        halign: 'center',
        cellPadding: 1.5,
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.5,
      },
      columnStyles: {
        3: { halign: 'right' },
      },
    });
  }

  // RIGHT SIDE: Calculation & Final Totals Box
  const totalsX = margin + halfWidth + 4;
  let totalsY = startSplitY;

  doc.setFillColor(250, 248, 245);
  doc.rect(totalsX, totalsY, halfWidth, 42, 'FD');
  doc.setDrawColor(200, 200, 200);

  const printTotalRow = (label: string, val: string, isBold = false, isAccent = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 8.5 : 7.5);
    doc.setTextColor(isAccent ? 180 : 40, isAccent ? 50 : 40, isAccent ? 20 : 40);
    doc.text(label, totalsX + 3, totalsY + 4);
    doc.text(val, totalsX + halfWidth - 3, totalsY + 4, { align: 'right' });
    totalsY += 4.5;
  };

  printTotalRow('Subtotal (Taxable Amount):', formatINR(bill.taxableAmount || bill.subtotal));
  if (bill.discount && bill.discount > 0) {
    printTotalRow('Discount Applied:', `-${formatINR(bill.discount)}`);
  }
  if (!bill.isInterState) {
    printTotalRow('CGST (Output Tax):', formatINR(bill.cgst || (bill.totalGST / 2)));
    printTotalRow('SGST (Output Tax):', formatINR(bill.sgst || (bill.totalGST / 2)));
  } else {
    printTotalRow('IGST (Integrated Tax):', formatINR(bill.igst || bill.totalGST));
  }
  if (bill.roundingAmount) {
    printTotalRow('Round Off (+/-):', `${bill.roundingAmount > 0 ? '+' : ''}${formatINR(bill.roundingAmount)}`);
  }

  doc.setLineWidth(0.3);
  doc.setDrawColor(180, 50, 20);
  doc.line(totalsX + 2, totalsY + 1, totalsX + halfWidth - 2, totalsY + 1);
  totalsY += 3;

  printTotalRow('GROSS TOTAL (INR):', formatINR(bill.grossTotal), true, true);
  printTotalRow('Total Advance / Paid:', formatINR(bill.advance || 0), true);
  printTotalRow('BALANCE DUE:', formatINR(bill.balance !== undefined ? bill.balance : Math.max(0, bill.grossTotal - (bill.advance || 0))), true, bill.balance > 0);

  y = Math.max(totalsY + 4, (doc as any).lastAutoTable.finalY + 4);

  // 7. Amount in Words Box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Amount in Words: INR ${bill.amountInWords || 'Zero Rupees Only'}`, margin + 3, y + 4.5);

  y += 9;

  // 8. Terms & Bank / Footer Notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  const termsText = [
    'Terms & Conditions:',
    '1. Goods/Services once billed cannot be refunded or transferred.',
    '2. Standard Check-in is 12:00 PM and Check-out is 11:00 AM (or per same-day agreement).',
    '3. All disputes are subject to Visakhapatnam jurisdiction only.',
  ];
  termsText.forEach((t) => {
    doc.text(t, margin + 2, y);
    y += 3;
  });

  // 9. Signatures (Bottom of Page)
  const sigY = 270;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);

  // Guest Signature
  doc.line(margin + 6, sigY - 2, margin + 50, sigY - 2);
  doc.text("Guest's Signature", margin + 14, sigY + 2);

  // Authorized Signatory
  doc.setFont('helvetica', 'bold');
  doc.line(margin + contentWidth - 55, sigY - 2, margin + contentWidth - 5, sigY - 2);
  doc.text(`For ${hotelName.toUpperCase()}`, margin + contentWidth - 52, sigY + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Authorized Signatory', margin + contentWidth - 45, sigY + 5.5);

  return doc;
}

/**
 * Downloads a crisp, selectable text A4 PDF directly from the stored Bill snapshot.
 */
export async function downloadBillPDF(bill: Bill, settings?: HotelSettings): Promise<void> {
  try {
    const doc = generateBillPDF(bill, settings);
    const invoiceNum = (bill.billNo || bill.billId || 'invoice').replace(/[^a-zA-Z0-9-_]/g, '_');
    const guestName = (bill.guestName || 'guest').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Invoice_${invoiceNum}_${guestName}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error('Error generating vector PDF:', error);
    // Fallback: trigger print
    window.print();
  }
}

/**
 * Legacy wrapper to maintain full backwards compatibility if called with elementId
 */
export async function downloadInvoicePDF(elementId: string, filename: string): Promise<void> {
  // If elementId is present, we trigger window.print() or native save
  window.print();
}
