// ─── ECCHANNA DAIRY · data.js ─────────────────────────────────────────────
// All data lives in localStorage under these keys.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BREEDS = [
  { name: 'Malnad Gidda', rate: 80,  emoji: '🐄' },
  { name: 'Kaat Petta',   rate: 70,  emoji: '🐄' },
  { name: 'HF Cow',       rate: 60,  emoji: '🐄' },
  { name: 'Desi Cow',     rate: 65,  emoji: '🐄' },
  { name: 'Buffalo',      rate: 90,  emoji: '🐃' },
];

const DB = {
  /* ── CUSTOMERS ── */
  get customers() {
    return JSON.parse(localStorage.getItem('dairy_customers') || '[]');
  },
  set customers(v) {
    localStorage.setItem('dairy_customers', JSON.stringify(v));
  },

  /* ── BILLS (one record per customer per month) ── */
  get bills() {
    return JSON.parse(localStorage.getItem('dairy_bills') || '[]');
  },
  set bills(v) {
    localStorage.setItem('dairy_bills', JSON.stringify(v));
  },

  /* ── BREEDS ── */
  get breeds() {
    const stored = localStorage.getItem('dairy_breeds');
    return stored ? JSON.parse(stored) : [...DEFAULT_BREEDS];
  },
  set breeds(v) {
    localStorage.setItem('dairy_breeds', JSON.stringify(v));
  },

  /* ── APP SETTINGS ── */
  get settings() {
    const s = JSON.parse(localStorage.getItem('dairy_settings') || '{}');
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return {
      gpay:      s.gpay      || '',
      paytm:     s.paytm     || '',
      bizName:   s.bizName   || 'Ecchanna Dairy Services',
      billMonth: s.billMonth || `${now.getFullYear()}-${mm}`,
      billDays:  s.billDays  || 30,
    };
  },
  set settings(v) {
    localStorage.setItem('dairy_settings', JSON.stringify(v));
  },

  /* ── AI READ HISTORY ── */
  get aiHistory() {
    return JSON.parse(localStorage.getItem('dairy_ai_history') || '[]');
  },
  set aiHistory(v) {
    localStorage.setItem('dairy_ai_history', JSON.stringify(v));
  },

  /* ── UTILITY ── */
  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  },

  /* ── BALANCE FOR ONE CUSTOMER (across all months) ── */
  customerBalance(custId) {
    return this.bills
      .filter(b => b.custId === custId)
      .reduce((sum, b) => sum + (b.totalBill - b.amountPaid), 0);
  },
};
