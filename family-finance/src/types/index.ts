// Typy pre aplikáciu Rodinný Finančný Analyzátor

export type AccountType = 'CHECKING' | 'INVESTMENT' | 'SAVINGS';

export type BankName = 'mBank' | 'SLSP' | 'Revolut' | 'Patria' | 'Portu' | 'PSS' | 'Unknown';

export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  counterparty?: string;
  counterpartyAccount?: string;
  description?: string;
  variableSymbol?: string;
  specificSymbol?: string;
  constantSymbol?: string;
  category?: string;
  rawData?: Record<string, unknown>;
}

export interface ImportResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: string[];
  bankName: BankName;
  accountNumber?: string;
  duplicatesSkipped: number;
}

export interface ParserStrategy {
  name: BankName;
  canParse(headers: string[], content: string): boolean;
  parse(content: string | ArrayBuffer, filename: string): Promise<ParsedTransaction[]>;
  detectAccountNumber(content: string | ArrayBuffer): string | null;
}

// Filter state pre transakcie
export interface TransactionFilters {
  accountId?: string;
  bankName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  searchText?: string;
  category?: string;
  showInternalTransfers?: boolean;
}

// Analytics summary
export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  incomeWithoutTransfers: number;
  expenseWithoutTransfers: number;
  netCashFlowWithoutTransfers: number;
  byCategory: CategorySummary[];
  byMonth: MonthlySummary[];
}

export interface CategorySummary {
  category: string;
  income: number;
  expense: number;
  count: number;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  netCashFlow: number;
}

// Enable Banking types
export interface EnableBankingSession {
  sessionId: string;
  authorizationUrl: string;
  expiresAt: Date;
}

export interface EnableBankingAccount {
  resourceId: string;
  iban: string;
  currency: string;
  ownerName: string;
  name?: string;
}

export interface EnableBankingTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  creditorName?: string;
  creditorAccount?: {
    iban?: string;
  };
  debtorName?: string;
  debtorAccount?: {
    iban?: string;
  };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
}
