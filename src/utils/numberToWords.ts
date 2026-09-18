/**
 * Converts a numeric amount into Indian Currency Words.
 * e.g., 3360 -> "THREE THOUSAND THREE HUNDRED SIXTY RUPEES ONLY"
 */

const units = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
];

const tens = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'
];

function convertLessThanThousand(num: number): string {
  let current = '';

  if (num >= 100) {
    current += units[Math.floor(num / 100)] + ' HUNDRED ';
    num %= 100;
  }

  if (num >= 20) {
    current += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }

  if (num > 0) {
    current += units[num] + ' ';
  }

  return current.trim();
}

export function convertAmountToWords(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return 'ZERO RUPEES ONLY';
  }

  const isNegative = amount < 0;
  let absoluteAmount = Math.abs(amount);

  const rupees = Math.floor(absoluteAmount);
  const paise = Math.round((absoluteAmount - rupees) * 100);

  let words = '';

  if (rupees === 0) {
    words = '';
  } else {
    // Indian numbering: Crores, Lakhs, Thousands, Hundreds
    const crore = Math.floor(rupees / 10000000);
    let remainder = rupees % 10000000;

    const lakh = Math.floor(remainder / 100000);
    remainder %= 100000;

    const thousand = Math.floor(remainder / 1000);
    remainder %= 1000;

    const hundreds = remainder;

    if (crore > 0) {
      words += convertLessThanThousand(crore) + ' CRORE ';
    }
    if (lakh > 0) {
      words += convertLessThanThousand(lakh) + ' LAKH ';
    }
    if (thousand > 0) {
      words += convertLessThanThousand(thousand) + ' THOUSAND ';
    }
    if (hundreds > 0) {
      words += convertLessThanThousand(hundreds) + ' ';
    }

    words = words.trim() + ' RUPEES';
  }

  if (paise > 0) {
    const paiseWords = convertLessThanThousand(paise);
    if (words.length > 0) {
      words += ' AND ' + paiseWords + ' PAISE';
    } else {
      words = paiseWords + ' PAISE';
    }
  }

  const result = (isNegative ? 'MINUS ' : '') + words.trim() + ' ONLY';
  return result.replace(/\s+/g, ' ').toUpperCase();
}
