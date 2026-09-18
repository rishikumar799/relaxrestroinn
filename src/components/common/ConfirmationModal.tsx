import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant,
  isDanger,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  const effectiveVariant = isDanger ? 'danger' : (variant || 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#FFFDF9] rounded-2xl shadow-2xl border border-amber-200 p-6 overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            variant === 'danger' 
              ? 'bg-red-100 text-red-600 border border-red-200' 
              : variant === 'warning' 
              ? 'bg-amber-100 text-amber-700 border border-amber-200' 
              : 'bg-orange-100 text-orange-700 border border-orange-200'
          }`}>
            {variant === 'danger' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : variant === 'warning' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <Info className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-bold text-stone-900 font-['Outfit',sans-serif]">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-white ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
