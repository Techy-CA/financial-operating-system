/**
 * formatters.js
 * All display formatting. Never format inline in templates.
 */

/**
 * Format number as Indian Rupees
 * ₹1,23,456 (Indian comma system)
 */
export function formatCurrency(value, opts = {}) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const num = Number(value);
  const { compact = false, symbol = true, decimals = 2 } = opts;

  if (compact) {
    if (Math.abs(num) >= 10000000) {
      return `${symbol ? '₹' : ''}${(num / 10000000).toFixed(2)}Cr`;
    }
    if (Math.abs(num) >= 100000) {
      return `${symbol ? '₹' : ''}${(num / 100000).toFixed(2)}L`;
    }
    if (Math.abs(num) >= 1000) {
      return `${symbol ? '₹' : ''}${(num / 1000).toFixed(1)}K`;
    }
  }

  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const prefix = num < 0 ? '-' : '';
  return `${prefix}${symbol ? '₹' : ''}${formatted}`;
}

/**
 * Short currency for display in metric cards
 * ₹18.6L | ₹2.4Cr | ₹54,800
 */
export function formatCurrencyShort(value) {
  return formatCurrency(value, { compact: true });
}

/**
 * Format date to display string
 */
export function formatDate(value, format = 'medium') {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return '—';

  const formats = {
    short:    { day: '2-digit', month: 'short', year: '2-digit' },    // 05 Jun '25
    medium:   { day: '2-digit', month: 'short', year: 'numeric' },    // 05 Jun 2025
    long:     { day: 'numeric', month: 'long',  year: 'numeric' },    // 5 June 2025
    monthYear:{ month: 'short', year: 'numeric' },                     // Jun 2025
    numeric:  { day: '2-digit', month: '2-digit', year: 'numeric' },  // 05/06/2025
  };

  return date.toLocaleDateString('en-IN', formats[format] || formats.medium);
}

/**
 * Format date for input[type=date]
 * Returns YYYY-MM-DD
 */
export function formatDateInput(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Days ago / from now
 */
export function formatRelative(value) {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  const diff  = Date.now() - date.getTime();
  const days  = Math.floor(Math.abs(diff) / 86400000);
  const past  = diff > 0;

  if (days === 0) return 'Today';
  if (days === 1) return past ? 'Yesterday' : 'Tomorrow';
  if (days < 7)   return `${days} day${days > 1 ? 's' : ''} ${past ? 'ago' : 'from now'}`;
  if (days < 30)  return `${Math.floor(days / 7)} week${Math.floor(days/7) > 1 ? 's' : ''} ${past ? 'ago' : 'from now'}`;
  return formatDate(date);
}

/**
 * Days overdue (positive = overdue, negative = days remaining)
 */
export function overdueDays(dueDate) {
  if (!dueDate) return 0;
  const due  = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
  const diff = Math.floor((Date.now() - due.getTime()) / 86400000);
  return diff;
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format GST number display: 22AAAAA0000A1Z5 → 22AAAAA0000A1Z5
 * (just ensures uppercase)
 */
export function formatGSTIN(gstin) {
  return gstin?.toString().toUpperCase().trim() || '';
}

/**
 * Format phone number: 9876543210 → +91 98765 43210
 */
export function formatPhone(phone) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Truncate text
 */
export function truncate(text, maxLen = 40) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/**
 * Initials from name (for avatars)
 */
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Color class for avatar backgrounds (deterministic by name)
 */
export function avatarColor(name = '') {
  const colors = [
    { bg: '#EEF2FF', text: '#3730A3' },  // indigo
    { bg: '#E0F2FE', text: '#0369A1' },  // sky
    { bg: '#D1FAE5', text: '#065F46' },  // emerald
    { bg: '#FEF3C7', text: '#92400E' },  // amber
    { bg: '#FCE7F3', text: '#9D174D' },  // pink
    { bg: '#F3E8FF', text: '#6B21A8' },  // purple
    { bg: '#FFEDD5', text: '#9A3412' },  // orange
  ];
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

/**
 * Amount change display: +23% ↑ or -5% ↓
 */
export function formatChange(current, previous) {
  if (!previous) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  const dir  = pct >= 0 ? 'up' : 'dn';
  const arrow = pct >= 0 ? '↑' : '↓';
  return { text: `${sign}${pct.toFixed(1)}%`, dir, arrow };
}

/**
 * Aging bucket label
 */
export function agingBucket(days) {
  if (days <= 0)  return 'current';
  if (days <= 30) return '1-30 days';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return '90+ days';
}
