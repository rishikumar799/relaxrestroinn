import { BillLineItem, TaxSummaryItem, BillSummaryItem } from '../types';
import { roundToTwo } from './currency';
import { formatAmountInWords } from './numberToWords';

/**
 * Calculates line-item totals given rate, days, discount, and gstRate.
 */
export function calculateLineItem(item: Partial<BillLineItem>): BillLineItem {
  const rate = parseFloat(String(item.rate)) || 0;
  
  let daysNum = 1;
  let rawDays = item.numberOfDays !== undefined ? item.numberOfDays : (item.days !== undefined ? item.days : 1);
  if (rawDays === '-' || rawDays === '' || rawDays === 0 || rawDays === null) {
    daysNum = 1;
  } else {
    daysNum = parseFloat(String(rawDays)) || 1;
  }

  // Value calculation: If days is given as numerical > 0, value = rate * daysNum, otherwise rate
  const value = item.value !== undefined ? parseFloat(String(item.value)) || roundToTwo(rate * daysNum) : roundToTwo(rate * daysNum);
  const discount = parseFloat(String(item.discount)) || 0;
  const total = roundToTwo(Math.max(0, value - discount));
  
  const gstRate = item.gstRate !== undefined ? parseFloat(String(item.gstRate)) || 0 : (item.gst !== undefined ? 12 : 12);
  const gstAmount = roundToTwo((total * gstRate) / 100);
  const netTotal = roundToTwo(total + gstAmount);

  return {
    id: item.id || `li-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    date: item.date || new Date().toISOString().split('T')[0],
    roomDetails: item.roomDetails || '',
    description: item.description || 'TARIFF',
    rate,
    numberOfDays: rawDays,
    days: typeof rawDays === 'number' ? rawDays : undefined,
    value,
    discount,
    total,
    gstRate,
    gstAmount,
    gst: gstAmount,
    netTotal,
    hsn: item.hsn || '996311',
  };
}

/**
 * Generates the TAX SUMMARY table dynamically by aggregating all line items by GST rate.
 * Intra-state creates Sgst@X and Cgst@X rows.
 * Inter-state creates Igst@X rows.
 */
export function computeTaxSummary(lineItems: BillLineItem[], isInterState = false): TaxSummaryItem[] {
  // Group taxable amounts and tax amounts by gstRate
  const rateMap = new Map<number, { taxableAmount: number; taxAmount: number }>();

  for (const item of lineItems) {
    const rate = item.gstRate || 0;
    if (rate <= 0 || item.total <= 0) continue;

    const existing = rateMap.get(rate) || { taxableAmount: 0, taxAmount: 0 };
    existing.taxableAmount = roundToTwo(existing.taxableAmount + item.total);
    existing.taxAmount = roundToTwo(existing.taxAmount + (item.gstAmount || ((item.total * rate) / 100)));
    rateMap.set(rate, existing);
  }

  const result: TaxSummaryItem[] = [];

  // Sort rates ascending (e.g. 5% first, then 12%, then 18%)
  const sortedRates = Array.from(rateMap.keys()).sort((a, b) => a - b);

  for (const rate of sortedRates) {
    const data = rateMap.get(rate)!;
    if (isInterState) {
      const rateLabel = rate % 1 === 0 ? String(rate) : rate.toFixed(1);
      result.push({
        taxName: `Igst@${rateLabel}`,
        accountName: `Igst@${rateLabel}`,
        taxRate: rate,
        taxableAmount: data.taxableAmount,
        taxAmount: data.taxAmount,
      });
    } else {
      const halfRate = rate / 2;
      const halfLabel = halfRate % 1 === 0 ? String(halfRate) : halfRate.toFixed(1);
      const halfTax = roundToTwo(data.taxAmount / 2);

      // In the sample invoice: Sgst@2.5, Cgst@2.5, Cgst@6, Sgst@6
      result.push({
        taxName: `Sgst@${halfLabel}`,
        accountName: `Sgst@${halfLabel}`,
        taxRate: halfRate,
        taxableAmount: data.taxableAmount,
        taxAmount: halfTax,
      });
      result.push({
        taxName: `Cgst@${halfLabel}`,
        accountName: `Cgst@${halfLabel}`,
        taxRate: halfRate,
        taxableAmount: data.taxableAmount,
        taxAmount: halfTax,
      });
    }
  }

  return result;
}

/**
 * Computes subtotal, total GST, rounding adjustment, gross total, advance, and balance.
 */
export function computeBillTotals(
  lineItems: BillLineItem[], 
  advance = 0, 
  customRounding?: number
) {
  let subtotal = 0; // Sum of taxable value (item.total)
  let totalValue = 0; // Sum of item.value
  let totalDiscount = 0; // Sum of item.discount
  let totalGST = 0; // Sum of item.gstAmount
  let grossTotalBeforeRounding = 0; // Sum of item.netTotal

  for (const item of lineItems) {
    totalValue = roundToTwo(totalValue + (item.value || 0));
    totalDiscount = roundToTwo(totalDiscount + (item.discount || 0));
    subtotal = roundToTwo(subtotal + (item.total || 0));
    totalGST = roundToTwo(totalGST + (item.gstAmount || 0));
    grossTotalBeforeRounding = roundToTwo(grossTotalBeforeRounding + (item.netTotal || 0));
  }

  // Calculate default rounding: round to nearest whole rupee or 0.00
  // e.g. 2279.99 -> 2280.00, rounding = +0.01
  let grossTotal = Math.round(grossTotalBeforeRounding);
  let roundingAmount = roundToTwo(grossTotal - grossTotalBeforeRounding);

  // If custom rounding override was specified
  if (customRounding !== undefined && !isNaN(customRounding)) {
    roundingAmount = roundToTwo(customRounding);
    grossTotal = roundToTwo(grossTotalBeforeRounding + roundingAmount);
  }

  const advancePaid = roundToTwo(advance);
  const balance = roundToTwo(Math.max(0, grossTotal - advancePaid));
  const amountInWords = formatAmountInWords(grossTotal);

  return {
    totalValue,
    totalDiscount,
    subtotal,
    totalGST,
    grossTotalBeforeRounding,
    roundingAmount,
    grossTotal,
    advance: advancePaid,
    balance,
    amountInWords,
  };
}
