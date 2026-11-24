import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  children,
  disabled = false,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h3 id="confirm-dialog-title" className="text-sm font-semibold text-[#1E293B]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-[#64748B]">{description}</p>
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F1F5F9] whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                : 'bg-[#0044B3] hover:bg-[#003591]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
