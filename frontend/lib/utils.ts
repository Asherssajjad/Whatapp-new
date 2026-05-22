import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return formatTime(d);
  if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('92')) return `+${phone}`;
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export function getInitials(name: string | null | undefined, phone: string): string {
  if (name) return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return phone.slice(-2);
}

export function leadScoreColor(score: number): string {
  if (score >= 80) return 'text-red-500';
  if (score >= 50) return 'text-orange-500';
  if (score >= 20) return 'text-yellow-500';
  return 'text-gray-400';
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ESCALATED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    RESOLVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
