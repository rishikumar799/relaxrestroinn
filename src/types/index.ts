/**
 * RELAX RESTO INN - Core Data Models & TypeScript Types
 */

export interface HotelSettings {
  id?: string;
  hotelName: string;
  legalName: string;
  cin: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  website: string;
  stateCode: string;
  placeOfSupply: string;
  authorizedByName: string;
  verifiedByName: string;
  invoiceFooter: string;
  footerNote?: string;
  logoUrl?: string;
  invoicePrefix: string;
  invoiceStartSequence: number;
  invoiceSuffix: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  defaultGSTRate: number;
  hsnCode: string;
  updatedAt?: any;
}

export interface Guest {
  guestId: string;
  guestName: string;
  phone: string;
  email?: string;
  address?: string;
  idType: 'Aadhaar Card' | 'Passport' | 'Driving License' | 'Voter ID' | 'PAN Card' | 'Other';
  idNumber: string;
  companyName?: string;
  companyAddress?: string;
  companyGSTIN?: string;
  totalStays: number;
  totalSpent: number;
  lastStayDate?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type RoomStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'Maintenance' | 'Blocked';
export type PlanType = 'EP' | 'CP' | 'MAP' | 'AP';

export interface Room {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: string | number;
  capacityAdults?: number;
  capacityChildren?: number;
  maxAdults?: number;
  maxChildren?: number;
  planType: PlanType;
  tariff: number;
  status: RoomStatus;
  currentStayId?: string;
  currentGuestName?: string;
  currentCheckInDate?: string;
  currentExpectedCheckOut?: string;
  amenities?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit' | 'Other';

export interface ExtraChargeItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface Stay {
  stayId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestAddress?: string;
  idType: string;
  idNumber: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  planType: PlanType;
  paxAdults: number;
  paxChildren: number;
  companyName?: string;
  companyAddress?: string;
  companyGSTIN?: string;
  bookingId?: string;
  grcNumber?: string;
  refOTA?: string;
  refOTAGSTIN?: string;
  checkInDate: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm
  expectedCheckOutDate: string; // YYYY-MM-DD
  expectedCheckOutTime: string; // HH:mm
  actualCheckOutDate?: string;
  actualCheckOutTime?: string;
  numberOfDays: number;
  roomTariff: number; // per day
  gstRate: number; // e.g. 12
  isInterState?: boolean; // true = IGST, false = CGST+SGST
  discount: number;
  extraCharges: number;
  extraChargesList?: ExtraChargeItem[];
  subtotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  grossTotal: number;
  advancePaid: number;
  balanceDue: number;
  paymentType: PaymentMethod;
  status: 'active' | 'checked_out' | 'cancelled';
  notes?: string;
  billId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface BillLineItem {
  id: string;
  date: string;
  roomDetails?: string;
  description: string;
  rate: number;
  numberOfDays?: number | string;
  days?: number;
  value: number;
  discount: number;
  total: number;
  gstRate: number; // e.g. 12, 5, 18, 0
  gstAmount: number;
  gst?: number;
  netTotal: number;
  hsn?: string;
}

export interface BillSummaryItem {
  accountName: string;
  amount: number;
}

export interface AdvanceReceiptItem {
  date: string;
  description?: string;
  desc?: string;
  refNo: string;
  roomDetails?: string;
  room?: string;
  amount: number;
  paymentType?: string;
  paymentId?: string;
}

export interface TaxSummaryItem {
  accountName?: string;
  taxName: string; // e.g. Sgst@2.5, Cgst@2.5, Cgst@6, Sgst@6, Igst@12
  taxRate?: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface Bill {
  billId: string;
  billNo: string;
  billDate: string; // YYYY-MM-DD
  billTime?: string;
  billType: 'stay' | 'manual';
  status: 'paid' | 'pending' | 'partially_paid' | 'void';
  guestId?: string;
  stayId?: string;
  guestName: string;
  guestPhone: string;
  guestAddress: string;
  guestEmail?: string;
  
  // Pax counts
  paxAdult?: number;
  paxChild?: number;
  pax: string; // e.g. "(Adult : 6, Child : 0)"

  // ID Card
  idCardNumber: string;
  idCardType?: string;

  // Company Info
  companyName?: string;
  companyAddress?: string;
  companyDetails: string;
  companyGSTIN: string;

  // OTA / Ref
  refOTA: string;
  refOTAGSTIN: string;

  // Location
  stateCode: string;
  placeOfSupply: string;

  // Room & Stay
  roomNumber: string;
  roomType: string;
  roomDetails: string; // e.g. "309-SUIT ROOM ( Plan Type : CP)"
  planType: string;

  // Check-in / Check-out
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;

  // Booking & GRC
  bookingId: string;
  reservationId?: string;
  grcNumber: string;

  // Payment & Days
  paymentType: PaymentMethod | string;
  numberOfDays: number;

  // Line items
  lineItems: BillLineItem[];

  // Totals & Rounding
  subtotal: number;
  roundingAmount?: number;
  grossTotalBeforeRounding?: number;
  grossTotal: number;
  advance: number;
  balance: number;
  amountInWords: string;

  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  isInterState?: boolean;

  // Summaries
  summary: BillSummaryItem[];
  advanceReceiptDetails?: AdvanceReceiptItem[];
  advanceDetails: AdvanceReceiptItem[];
  taxSummary: TaxSummaryItem[];

  // Signatures
  authorizedBy: string;
  verifiedBy: string;
  guestSignatureName: string;
  guestSignaturePlace: string;
  signatureImageUrl?: string;

  notes?: string;
  voidReason?: string;
  deleted?: boolean;
  deletedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export interface Payment {
  paymentId: string;
  billId: string;
  billNo?: string;
  stayId?: string;
  guestId?: string;
  guestName?: string;
  roomNumber?: string;
  amount: number;
  paymentType: PaymentMethod;
  paymentMethod?: PaymentMethod;
  paymentTime?: string;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  createdAt?: any;
}

export interface ActivityLog {
  logId: string;
  action: 'LOGIN' | 'CHECK_IN_CREATED' | 'CHECKOUT_COMPLETED' | 'BILL_CREATED' | 'BILL_EDITED' | 'PAYMENT_ADDED' | 'MANUAL_BILL_CREATED' | 'BILL_PRINTED' | 'BILL_VOIDED' | 'BILL_DELETED' | 'SETTINGS_UPDATED' | 'ROOM_STATUS_CHANGED' | 'ROOM_ADDED' | 'ROOM_UPDATED';
  userUid?: string;
  userEmail: string;
  timestamp: any;
  entityType: 'stay' | 'bill' | 'guest' | 'room' | 'payment' | 'settings' | 'auth';
  entityId: string;
  description: string;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  cardRevenue: number;
  bankRevenue: number;
  checkInCount: number;
  checkOutCount: number;
  activeStaysCount: number;
  occupiedRoomsCount: number;
  billsCount: number;
  totalGST: number;
}
