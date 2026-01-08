import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import CryptoJS from "crypto-js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generuje unikátny hash pre transakciu na základe dátumu, sumy a popisu
 * Používa sa na deduplikáciu - rovnaké transakcie nebudú importované viackrát
 */
export function generateTransactionHash(
  accountId: string,
  date: Date,
  amount: number,
  description?: string,
  counterparty?: string
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const amountStr = amount.toFixed(2);
  const descNormalized = (description || '').toLowerCase().trim();
  const counterpartyNormalized = (counterparty || '').toLowerCase().trim();
  
  const input = `${accountId}|${dateStr}|${amountStr}|${descNormalized}|${counterpartyNormalized}`;
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex).substring(0, 32);
}

/**
 * Formátuje sumu s menou
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Formátuje dátum v slovenskom formáte
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Parsuje dátum z rôznych formátov
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Vyskúšaj rôzne formáty
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // Slovak format DD.MM.YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    // US format MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // German format DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ];
  
  // ISO format
  let match = dateStr.match(formats[0]);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  // Slovak format DD.MM.YYYY
  match = dateStr.match(formats[1]);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  
  // Fallback na natívny parser
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normalizuje sumu z rôznych formátov
 */
export function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Odstráň medzery a meny
  let normalized = amountStr.toString().trim();
  normalized = normalized.replace(/[€$£\s]/g, '');
  
  // Zisti formát čísla (európsky vs americký)
  const hasCommaDecimal = normalized.match(/,\d{1,2}$/);
  const hasDotDecimal = normalized.match(/\.\d{1,2}$/);
  
  if (hasCommaDecimal && !hasDotDecimal) {
    // Európsky formát: 1.234,56 -> 1234.56
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasDotDecimal && !hasCommaDecimal) {
    // Americký formát: 1,234.56 -> 1234.56
    normalized = normalized.replace(/,/g, '');
  }
  
  const amount = parseFloat(normalized);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Kategorizácia na základe kľúčových slov
 */
export const DEFAULT_CATEGORY_RULES: Array<{ keyword: string; category: string }> = [
  // Potraviny
  { keyword: 'tesco', category: 'Groceries' },
  { keyword: 'billa', category: 'Groceries' },
  { keyword: 'lidl', category: 'Groceries' },
  { keyword: 'kaufland', category: 'Groceries' },
  { keyword: 'coop jednota', category: 'Groceries' },
  { keyword: 'freshmarket', category: 'Groceries' },
  { keyword: 'albert', category: 'Groceries' },
  { keyword: 'penny', category: 'Groceries' },
  
  // Pohonné hmoty
  { keyword: 'shell', category: 'Fuel' },
  { keyword: 'omv', category: 'Fuel' },
  { keyword: 'slovnaft', category: 'Fuel' },
  { keyword: 'benzina', category: 'Fuel' },
  { keyword: 'mol', category: 'Fuel' },
  { keyword: 'orlen', category: 'Fuel' },
  
  // Utility
  { keyword: 'spp', category: 'Utilities' },
  { keyword: 'zse', category: 'Utilities' },
  { keyword: 'sse', category: 'Utilities' },
  { keyword: 'vodaren', category: 'Utilities' },
  { keyword: 'orange', category: 'Utilities' },
  { keyword: 'telekom', category: 'Utilities' },
  { keyword: 'o2', category: 'Utilities' },
  { keyword: '4ka', category: 'Utilities' },
  
  // Reštaurácie
  { keyword: 'mcdonald', category: 'Restaurants' },
  { keyword: 'kfc', category: 'Restaurants' },
  { keyword: 'subway', category: 'Restaurants' },
  { keyword: 'pizza', category: 'Restaurants' },
  { keyword: 'restaurant', category: 'Restaurants' },
  { keyword: 'bistro', category: 'Restaurants' },
  
  // Transport
  { keyword: 'bolt', category: 'Transport' },
  { keyword: 'uber', category: 'Transport' },
  { keyword: 'taxi', category: 'Transport' },
  { keyword: 'zssk', category: 'Transport' },
  { keyword: 'dpb', category: 'Transport' },
  { keyword: 'sad', category: 'Transport' },
  
  // Zábava
  { keyword: 'netflix', category: 'Entertainment' },
  { keyword: 'spotify', category: 'Entertainment' },
  { keyword: 'hbo', category: 'Entertainment' },
  { keyword: 'cinema', category: 'Entertainment' },
  { keyword: 'kino', category: 'Entertainment' },
  
  // Zdravie
  { keyword: 'lekaren', category: 'Health' },
  { keyword: 'pharmacy', category: 'Health' },
  { keyword: 'dr.max', category: 'Health' },
  
  // Nákupy
  { keyword: 'alza', category: 'Shopping' },
  { keyword: 'mall.sk', category: 'Shopping' },
  { keyword: 'heureka', category: 'Shopping' },
  { keyword: 'amazon', category: 'Shopping' },
  { keyword: 'aliexpress', category: 'Shopping' },
  
  // Bývanie
  { keyword: 'nájom', category: 'Housing' },
  { keyword: 'rent', category: 'Housing' },
  { keyword: 'hypoteka', category: 'Housing' },
  { keyword: 'mortgage', category: 'Housing' },
  
  // Plat
  { keyword: 'mzda', category: 'Salary' },
  { keyword: 'salary', category: 'Salary' },
  { keyword: 'plat', category: 'Salary' },
  
  // Prevody
  { keyword: 'prevod', category: 'Transfer' },
  { keyword: 'transfer', category: 'Transfer' },
];

/**
 * Aplikuje pravidlá kategorizácie na transakciu
 */
export function categorizeTransaction(
  description: string,
  counterparty: string,
  customRules?: Array<{ keyword: string; category: string }>
): string | null {
  const rules = customRules || DEFAULT_CATEGORY_RULES;
  const searchText = `${description} ${counterparty}`.toLowerCase();
  
  for (const rule of rules) {
    if (searchText.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  
  return null;
}

/**
 * Zoznam všetkých dostupných kategórií
 */
export const CATEGORIES = [
  'Groceries',
  'Fuel',
  'Utilities',
  'Restaurants',
  'Transport',
  'Entertainment',
  'Health',
  'Shopping',
  'Housing',
  'Salary',
  'Transfer',
  'Investment',
  'Savings',
  'Other',
] as const;

export type Category = typeof CATEGORIES[number];
