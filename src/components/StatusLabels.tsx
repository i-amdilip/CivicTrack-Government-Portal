import React from 'react';
import type { ComplaintStatus, PriorityLevel } from '../types/civic';

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  New: 'text-[#0044B3] bg-[#EFF6FF] border-[#BFDBFE]',
  Reviewed: 'text-[#334155] bg-[#F1F5F9] border-[#CBD5E1]',
  Pending: 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]',
  'In Progress': 'text-[#0369A1] bg-[#F0F9FF] border-[#BAE6FD]',
  'Resolution Submitted': 'text-[#92400E] bg-[#FEF3C7] border-[#FCD34D]',
  Resolved: 'text-[#047857] bg-[#ECFDF5] border-[#A7F3D0]',
  Escalated: 'text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]',
  Rejected: 'text-[#64748B] bg-[#F8FAFC] border-[#E2E8F0]',
};

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  Critical: 'text-[#DC2626] font-semibold',
  High: 'text-[#D97706] font-semibold',
  Medium: 'text-[#0044B3] font-medium',
  Low: 'text-[#64748B] font-medium',
};

export const StatusLabel: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
  return (
    <span
      className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
};

export const PriorityLabel: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  return (
    <span className={`text-xs whitespace-nowrap ${PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  );
};

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
