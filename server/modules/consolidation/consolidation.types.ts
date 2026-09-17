// server/modules/consolidation/consolidation.types.ts
//
// ⚠️ STRICT FINANCIAL TYPES:
//   - كل واجهة تحمل isBalanced يجب أن تحمل معها discrepancyMinor (BigInt) و discrepancyDisplay.
//   - discrepancyMinor === 0n → متوازن. أي قيمة أخرى → فشل الـ invariant.
//   - discrepancyDisplay للعرض فقط. لا تُتخذ بها قرارات منطقية.

// ─────────────────────────────────────────────────────────────────
// Balance Sheet
// ─────────────────────────────────────────────────────────────────

export interface ConsolidatedBalanceSheet {
  timestamp: string;
  assets: {
    cashAndCashEquivalents: number;
    accountsReceivable: number;
    inventoryValue: number;
    otherCurrentAssets: number;
    nonCurrentAssets: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    otherCurrentLiabilities: number;
    nonCurrentLiabilities: number;
    totalLiabilities: number;
  };
  equity: {
    shareCapital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  isBalanced: boolean;
  /**
   * الفرق الفعلي = totalAssets - (totalLiabilities + totalEquity) بوحدات هللة.
   * ⚠️ صفر = متوازن. أي قيمة أخرى = فشل الـ invariant.
   */
  discrepancyMinor: bigint;
  /** نفس القيمة للعرض (بعد /100). لا تستخدمها للقرارات. */
  discrepancyDisplay: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      assets: number;
      liabilities: number;
      equity: number;
    };
  };
  eliminations: EliminationRecord[];
}

// ─────────────────────────────────────────────────────────────────
// Income Statement
// ─────────────────────────────────────────────────────────────────

export interface ConsolidatedIncomeStatement {
  timestamp: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: {
    salary: number;
    rent: number;
    utilities: number;
    marketing: number;
    other: number;
    totalOPEX: number;
  };
  operatingProfit: number;
  tax: number;
  netIncome: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      revenue: number;
      cogs: number;
      grossProfit: number;
      opex: number;
      netIncome: number;
    };
  };
  eliminations: EliminationRecord[];
}

// ─────────────────────────────────────────────────────────────────
// Cash Flow
// ─────────────────────────────────────────────────────────────────

export interface ConsolidatedCashFlow {
  timestamp: string;
  operatingActivities: {
    cashInflowSales: number;
    cashOutflowInventory: number;
    cashOutflowOPEX: number;
    netOperatingCash: number;
  };
  investingActivities: {
    capitalExpenditure: number;
    netInvestingCash: number;
  };
  financingActivities: {
    equityIssued: number;
    debtServicing: number;
    netFinancingCash: number;
  };
  netChangeInCash: number;
  beginningCashBalance: number;
  endingCashBalance: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      netOperating: number;
      netInvesting: number;
      netFinancing: number;
      endingChange: number;
    };
  };
  eliminations: EliminationRecord[];
}

// ─────────────────────────────────────────────────────────────────
// Trial Balance
// ─────────────────────────────────────────────────────────────────

export interface ConsolidatedTrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  /**
   * الرصيد الصافي:
   *   - موجب  → رصيد مدين (DEBIT preference)
   *   - سالب  → رصيد دائن (CREDIT preference)
   *   - صفر   → حساب مغلق
   */
  netBalance: number;
  balanceType: 'DEBIT' | 'CREDIT';
  branchBreakdowns: {
    [branchId: string]: {
      branchName: string;
      debit: number;
      credit: number;
      netBalance: number;
    };
  };
}

export interface ConsolidatedTrialBalance {
  timestamp: string;
  rows: ConsolidatedTrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  /**
   * الفرق الفعلي = totalDebit - totalCredit بوحدات هللة.
   * ⚠️ صفر = متوازن. أي قيمة أخرى = فشل الـ invariant.
   */
  discrepancyMinor: bigint;
  /** نفس القيمة للعرض (بعد /100). لا تستخدمها للقرارات. */
  discrepancyDisplay: number;
  eliminations: EliminationRecord[];
}

// ─────────────────────────────────────────────────────────────────
// Inventory Valuation
// ─────────────────────────────────────────────────────────────────

export interface ConsolidatedInventoryValuation {
  timestamp: string;
  totalInventoryQuantity: number;
  totalInventoryValue: number;
  averageItemCost: number;
  uniqueSKUsCount: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      quantity: number;
      value: number;
      percentageOfTotal: number;
    };
  };
  slowMovingProducts: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
    cost: number;
    totalValue: number;
    daysSinceLastSale: number;
  }>;
  fastMovingProducts: Array<{
    id: string;
    sku: string;
    name: string;
    salesVolume: number;
    revenueGenerated: number;
    stockQuantity: number;
    /** نسبة المبيعات إلى المخزون الحالي */
    turnoverRate: number;
  }>;
  deadStock: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
    cost: number;
    totalValue: number;
    expiryDate: string | null;
    status: 'EXPIRED' | 'EXPIRING_SOON' | 'NO_SALES';
  }>;
}

// ─────────────────────────────────────────────────────────────────
// Eliminations
// ─────────────────────────────────────────────────────────────────

export interface EliminationRecord {
  id: string;
  type: 'TRANSFER' | 'INTERNAL_SALE' | 'INTERNAL_PURCHASE' | 'INTERNAL_MOVEMENT';
  description: string;
  /**
   * المبلغ بوحدات العملة الكبرى (مثل: 100.50 ريال).
   * ⚠️ للتدقيق الدقيق استخدم amountMinor.
   */
  amount: number;
  /**
   * نفس المبلغ بوحدات هللة (BigInt) — للتحقق المحاسبي الصارم.
   * مثال: 100.50 ريال → 10050n هللة.
   */
  amountMinor: bigint;
  referenceId?: string;
  sourceId?: string;
  targetId?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────
// AI Insights
// ─────────────────────────────────────────────────────────────────

export interface AIConsolidationInsights {
  revenueGrowthTrends: string;
  profitabilityAnalysis: string;
  inventoryTurnoverAnalysis: string;
  stockRiskWarnings: string[];
  reorderRecommendations: Array<{
    productId: string;
    sku: string;
    productName: string;
    currentStock: number;
    reorderQuantity: number;
    percentageGap: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────

export interface ConsolidationSummary {
  runId: string;
  timestamp: string;
  aggregateRevenue: number;
  aggregateNetIncome: number;
  aggregateAssets: number;
  aggregateLiabilities: number;
  aggregateEquity: number;
  aggregateInventoryValue: number;
  totalEliminationsDone: number;
  activeBranchesCount: number;
  insights: AIConsolidationInsights;
}
