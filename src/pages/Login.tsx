import React, { useState } from 'react';
import { loginAdmin } from '../services/authService';
import { Hotel, Lock, Mail, AlertCircle, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { HotelSettings } from '../types';

interface LoginProps {
  settings?: HotelSettings;
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ settings, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hotelName = settings?.hotelName || "RELAX RESTO INN";
  const legalName = settings?.legalName || "Ashritha Sai Services & Trading Pvt Ltd";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter your admin email address and password.');
      return;
    }

    try {
      setLoading(true);
      await loginAdmin(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8EE] via-[#FFF3E0] to-[#FFEBE5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Decorative Warm Ambient Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gradient-to-tl from-red-500/15 via-orange-400/15 to-amber-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-red-600 via-orange-500 to-amber-500 p-1 shadow-xl shadow-orange-500/25 mb-4">
            <div className="w-full h-full bg-stone-900 rounded-[22px] flex items-center justify-center">
              <Hotel className="w-10 h-10 text-amber-400" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 font-['Outfit',sans-serif]">
            {hotelName}
          </h1>
          <p className="text-xs font-semibold text-orange-800 tracking-wide uppercase mt-1">
            {legalName}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-amber-100/90 text-amber-950 border border-amber-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>Admin Authentication</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="mt-7 bg-[#FFFDF9]/95 backdrop-blur-md py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-amber-200/90 sm:rounded-3xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMsg}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="h-4 w-4 text-amber-600" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@relaxrestoinn.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-stone-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="h-4 w-4 text-amber-600" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all placeholder:text-stone-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-lg shadow-orange-600/30 text-sm font-bold text-white bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-all cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating Admin...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Hotel Location & GST Info */}
          <div className="mt-6 pt-5 border-t border-amber-100 text-center text-[11px] text-stone-500 space-y-1">
            <p className="font-semibold text-stone-700">
              {settings?.address || "#49-49-7, SHANTHIPURAM, VISAKHAPATNAM-530016"}
            </p>
            <p className="font-mono text-[10px] text-amber-900 font-bold">
              GSTIN: {settings?.gstin || "37AAWCA2881J2ZY"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
