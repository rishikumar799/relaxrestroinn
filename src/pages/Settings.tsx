import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Save, 
  Settings as SettingsIcon, 
  Image as ImageIcon, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  FileText,
  Clock,
  Sparkles,
  Copy,
  ExternalLink,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { HotelSettings } from '../types';
import { getHotelSettings, saveHotelSettings } from '../services/settingsService';
import { exportAllData } from '../services/reportService';
import { getAdminUsers, getCurrentUser, AdminUserRecord } from '../services/authService';
import { purgeAllDataAndStartFresh } from '../services/dataResetService';
import { useToast } from '../components/common/Toast';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface SettingsProps {
  settings?: HotelSettings;
  onSettingsUpdated: (newSettings: HotelSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings: initialSettings, onSettingsUpdated }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    getAdminUsers().then(users => setAdminUsers(users)).catch(() => {});
  }, []);

  // Form states
  const [hotelName, setHotelName] = useState(initialSettings?.hotelName || 'RELAX RESTO INN');
  const [legalName, setLegalName] = useState(initialSettings?.legalName || 'Ashritha Sai Services & Trading Pvt Ltd');
  const [cin, setCin] = useState(initialSettings?.cin || 'U55101AP2017PTC106720');
  const [address, setAddress] = useState(initialSettings?.address || '#49-49-7, SHANTHIPURAM, VISAKHAPATNAM-530016');
  const [phone, setPhone] = useState(initialSettings?.phone || '8125555679');
  const [email, setEmail] = useState(initialSettings?.email || 'relaxrestoinn@gmail.com');
  const [gstin, setGstin] = useState(initialSettings?.gstin || '37AAWCA2881J2ZY');
  const [stateCode, setStateCode] = useState(initialSettings?.stateCode || '37');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialSettings?.placeOfSupply || 'ANDHRA PRADESH (37)');
  const [hsnCode, setHsnCode] = useState(initialSettings?.hsnCode || '996311');
  const [defaultGSTRate, setDefaultGSTRate] = useState(initialSettings?.defaultGSTRate || 12);
  const [defaultCheckInTime, setDefaultCheckInTime] = useState(initialSettings?.defaultCheckInTime || '12:00');
  const [defaultCheckOutTime, setDefaultCheckOutTime] = useState(initialSettings?.defaultCheckOutTime || '11:00');
  const [authorizedByName, setAuthorizedByName] = useState(initialSettings?.authorizedByName || 'RELAX RESTO INN');
  const [verifiedByName, setVerifiedByName] = useState(initialSettings?.verifiedByName || 'FRONT DESK ADMIN');
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl || '');
  const [footerNote, setFooterNote] = useState(
    initialSettings?.footerNote || 'Thank you for choosing Relax Resto Inn. Have a pleasant journey!'
  );

  // Invoice Numbering
  const [invoicePrefix, setInvoicePrefix] = useState(initialSettings?.invoicePrefix || 'A-');
  const [invoiceSuffix, setInvoiceSuffix] = useState(initialSettings?.invoiceSuffix || '-24-25');

  useEffect(() => {
    if (initialSettings) {
      setHotelName(initialSettings.hotelName || 'RELAX RESTO INN');
      setLegalName(initialSettings.legalName || 'Ashritha Sai Services & Trading Pvt Ltd');
      setCin(initialSettings.cin || 'U55101AP2017PTC106720');
      setAddress(initialSettings.address || '#49-49-7, SHANTHIPURAM, VISAKHAPATNAM-530016');
      setPhone(initialSettings.phone || '8125555679');
      setEmail(initialSettings.email || 'relaxrestoinn@gmail.com');
      setGstin(initialSettings.gstin || '37AAWCA2881J2ZY');
      setStateCode(initialSettings.stateCode || '37');
      setPlaceOfSupply(initialSettings.placeOfSupply || 'ANDHRA PRADESH (37)');
      setHsnCode(initialSettings.hsnCode || '996311');
      setDefaultGSTRate(initialSettings.defaultGSTRate || 12);
      setDefaultCheckInTime(initialSettings.defaultCheckInTime || '12:00');
      setDefaultCheckOutTime(initialSettings.defaultCheckOutTime || '11:00');
      setAuthorizedByName(initialSettings.authorizedByName || 'RELAX RESTO INN');
      setVerifiedByName(initialSettings.verifiedByName || 'FRONT DESK ADMIN');
      setLogoUrl(initialSettings.logoUrl || '');
      setFooterNote(initialSettings.footerNote || '');
      setInvoicePrefix(initialSettings.invoicePrefix || 'A-');
      setInvoiceSuffix(initialSettings.invoiceSuffix || '-24-25');
    }
  }, [initialSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: Partial<HotelSettings> = {
        hotelName: hotelName.trim(),
        legalName: legalName.trim(),
        cin: cin.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim(),
        stateCode: stateCode.trim(),
        placeOfSupply: placeOfSupply.trim(),
        hsnCode: hsnCode.trim(),
        defaultGSTRate,
        defaultCheckInTime,
        defaultCheckOutTime,
        authorizedByName: authorizedByName.trim(),
        verifiedByName: verifiedByName.trim(),
        logoUrl: logoUrl.trim(),
        footerNote: footerNote.trim(),
        invoicePrefix: invoicePrefix.trim(),
        invoiceSuffix: invoiceSuffix.trim(),
      };

      await saveHotelSettings(payload);
      const updated = await getHotelSettings();
      onSettingsUpdated(updated);
      toast.success('Settings Saved', 'Hotel profile and invoice parameters updated.');
    } catch (err: any) {
      toast.error('Save Failed', err.message || 'Could not update settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setExporting(true);
      const backupJson = await exportAllData();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RELAX_RESTO_INN_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup Downloaded', 'Exported complete database as JSON.');
    } catch (err: any) {
      toast.error('Export Failed', err.message || 'Could not generate backup.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Hotel Configuration & Invoice Customization
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Configure legal entity details, GSTIN, invoice prefixes & automated database backup
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Legal Entity & Contact */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
            <Building className="w-4 h-4 text-orange-600" />
            <span>Legal Business Entity & Contact Profile</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Hotel Display Name *
              </label>
              <input
                type="text"
                required
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Legal Registered Entity Name *
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Corporate CIN Number
              </label>
              <input
                type="text"
                value={cin}
                onChange={(e) => setCin(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                GSTIN Number *
              </label>
              <input
                type="text"
                required
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold text-amber-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Complete Registered Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Front Desk Contact / Mobile *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Official Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tax & Statutory Invoicing Settings */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
            <FileText className="w-4 h-4 text-orange-600" />
            <span>Tax & Invoice Sequencing Parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="A-"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Invoice Suffix / FY
              </label>
              <input
                type="text"
                value={invoiceSuffix}
                onChange={(e) => setInvoiceSuffix(e.target.value)}
                placeholder="-24-25"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                HSN / SAC Code
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="996311"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                State Code
              </label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                placeholder="37"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Place of Supply
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="ANDHRA PRADESH (37)"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Default Check-in Time
              </label>
              <input
                type="time"
                value={defaultCheckInTime}
                onChange={(e) => setDefaultCheckInTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Default Check-out Time
              </label>
              <input
                type="time"
                value={defaultCheckOutTime}
                onChange={(e) => setDefaultCheckOutTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Default GST Rate (%)
              </label>
              <input
                type="number"
                value={defaultGSTRate}
                onChange={(e) => setDefaultGSTRate(parseFloat(e.target.value) || 12)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Authorized Signatory Text
              </label>
              <input
                type="text"
                value={authorizedByName}
                onChange={(e) => setAuthorizedByName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Verified By Text
              </label>
              <input
                type="text"
                value={verifiedByName}
                onChange={(e) => setVerifiedByName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Hotel Logo Image URL
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://... / public URL"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Invoice Footer Notice & Policies
              </label>
              <textarea
                rows={2}
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-amber-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-orange-600/30 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Section 3: Authorized Admin Team & Backend Collections */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-amber-100 pb-3">
          <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            <span>Authorized Administrator Accounts & Backend Sync</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Firebase Cloud Firestore Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Admin list */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-stone-900">Registered Admin Users ({adminUsers.length || 1})</h4>
              <button
                type="button"
                onClick={() => {
                  getAdminUsers().then(users => setAdminUsers(users));
                  toast.success('Admin users refreshed');
                }}
                className="text-[11px] text-orange-700 hover:text-orange-900 font-bold cursor-pointer"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {adminUsers.length > 0 ? (
                adminUsers.map((user, idx) => (
                  <div key={user.uid || idx} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100 text-xs shadow-2xs">
                    <div>
                      <div className="font-bold text-stone-900">{user.email}</div>
                      <div className="text-[10px] text-stone-500 font-mono">Role: {user.role || 'admin'} • Status: {user.status || 'active'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 uppercase">
                      {user.role || 'Admin'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-2.5 bg-white rounded-lg border border-amber-100 text-xs">
                  <div className="font-bold text-stone-900">{getCurrentUser()?.email || 'Active Administrator'}</div>
                  <div className="text-[10px] text-stone-500 font-mono">UID: {getCurrentUser()?.uid?.slice(0, 12)}... (Primary Admin)</div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-stone-500">
              Admin credentials and permissions are automatically synced to the <code className="text-orange-800 font-bold">admins</code> and <code className="text-orange-800 font-bold">users</code> collections in Firebase.
            </p>
          </div>

          {/* Backend Collections Directory */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
            <h4 className="font-bold text-xs text-stone-900">Active Backend Collections</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/admins</span>
                <p className="text-[10px] text-stone-500">Admin auth & profiles</p>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/rooms</span>
                <p className="text-[10px] text-stone-500">Rooms & tariff rates</p>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/stays</span>
                <p className="text-[10px] text-stone-500">Guest stays & check-ins</p>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/bills</span>
                <p className="text-[10px] text-stone-500">Tax invoices & GST totals</p>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/guests</span>
                <p className="text-[10px] text-stone-500">Customer CRM directory</p>
              </div>
              <div className="p-2 bg-white rounded border border-stone-200">
                <span className="font-bold text-stone-800">/payments</span>
                <p className="text-[10px] text-stone-500">Financial receipts & UPI</p>
              </div>
            </div>

            {/* Firestore rules snippet guide */}
            <div className="pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-700">Firebase Firestore Security Rules:</span>
                <button
                  type="button"
                  onClick={() => {
                    const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
                    navigator.clipboard.writeText(rules);
                    toast.success('Rules copied to clipboard', 'Paste into Firebase Console > Firestore > Rules tab');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-orange-700 hover:text-orange-900 font-bold cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Copy Rules
                </button>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                To allow persistent cloud reads & writes from your Firebase project, set <code className="text-orange-800 font-bold bg-amber-50 px-1 py-0.5 rounded">allow read, write: if true;</code> or authenticated rules in your Firebase Console.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Data Maintenance & Operations */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
          <SettingsIcon className="w-4 h-4 text-orange-600" />
          <span>System Utilities & Data Management</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-xs text-stone-900">Download Complete Database JSON Snapshot</h4>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Export all stays, bills, room inventory, guests, payment transactions and audit logs as an offline JSON snapshot.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating...' : 'Export JSON Backup'}</span>
            </button>
          </div>

          {/* Start From Scratch / Reset Data */}
          <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Reset All Entries & Start From Scratch</span>
              </div>
              <p className="text-[11px] text-red-700 mt-0.5">
                Permanently wipes all check-ins, check-outs, reservations, and sample bills from Firestore and local store. All 24 official rooms will be reset to available.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPurgeModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Start Fresh (Purge Entries)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Starting Fresh */}
      <ConfirmationModal
        isOpen={showPurgeModal}
        title="Reset All Entries & Start from Scratch?"
        message="This will permanently delete all check-in records, check-out history, test bills, payments, and reservations. All 24 rooms will be reset to Available. This action cannot be undone."
        confirmText={isPurging ? 'Purging records...' : 'Yes, Delete All & Start Fresh'}
        cancelText="Cancel"
        variant="danger"
        onConfirm={async () => {
          try {
            setIsPurging(true);
            await purgeAllDataAndStartFresh();
            toast.success('System Reset Complete', 'All previous entries purged. Starting clean from scratch!');
            setShowPurgeModal(false);
            window.location.reload();
          } catch (err: any) {
            toast.error('Reset Failed', err?.message || 'Could not reset database.');
          } finally {
            setIsPurging(false);
          }
        }}
        onCancel={() => setShowPurgeModal(false)}
      />
    </div>
  );
};
