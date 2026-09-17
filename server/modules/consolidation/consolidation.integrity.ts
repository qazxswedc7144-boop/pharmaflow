/**
 * PharmaFlow ERP — Consolidation Integrity Monitor (Strict Mode)
 *
 * ⚠️ تمت إزالة tolerance بالكامل:
 *   - لا 0.01، لا 0.05، لا أي رقم آخر.
 *   - التوازن المحاسبي إما دقيق أو غير موجود.
 */

import { FinancialMath } from './financial-math';

export interface IntegrityCheckResult {
  isBalanced: boolean;
  checkType: string;
  discrepancyMinor: bigint;
  discrepancyDisplay: number;
  expectedValue: number;
  actualValue: number;
  message: string;
}

export class ConsolidationIntegrityMonitor {
  /**
   * ✅ التحقق من توازن الميزانية العمومية — بدون tolerance.
   */
  public static verifyBalanceSheet(
    balanceSheet: {
      assets: { totalAssets: number };
      liabilities: { totalLiabilities: number };
      equity: { totalEquity: number };
    },
    _tenantId: string,
    _correlationId?: string,
  ): IntegrityCheckResult {
    const assets = balanceSheet.assets.totalAssets;
    const liabilitiesAndEquity = FinancialMath.add(
      balanceSheet.liabilities.totalLiabilities,
      balanceSheet.equity.totalEquity,
    );

    const discrepancyMinor = FinancialMath.discrepancyMinor(assets, liabilitiesAndEquity);
    const isBalanced = FinancialMath.isBalanced(assets, liabilitiesAndEquity);

    return {
      isBalanced,
      checkType: 'BALANCE_SHEET',
      discrepancyMinor,
      discrepancyDisplay: Number(discrepancyMinor) / 100,
      expectedValue: assets,
      actualValue: liabilitiesAndEquity,
      message: isBalanced
        ? 'Consolidated Balance Sheet is in exact mathematical equilibrium.'
        : `BALANCE_SHEET_IMBALANCE: ${discrepancyMinor} minor units discrepancy`,
    };
  }

  /**
   * ✅ التحقق من توازن ميزان المراجعة — بدون tolerance.
   */
  public static verifyTrialBalance(
    trialBalance: { totalDebit: number; totalCredit: number },
    _tenantId: string,
    _correlationId?: string,
  ): IntegrityCheckResult {
    const debits = trialBalance.totalDebit;
    const credits = trialBalance.totalCredit;

    const discrepancyMinor = FinancialMath.discrepancyMinor(debits, credits);
    const isBalanced = FinancialMath.isBalanced(debits, credits);

    return {
      isBalanced,
      checkType: 'TRIAL_BALANCE',
      discrepancyMinor,
      discrepancyDisplay: Number(discrepancyMinor) / 100,
      expectedValue: debits,
      actualValue: credits,
      message: isBalanced
        ? 'Trial balance is in exact mathematical equilibrium.'
        : `TRIAL_BALANCE_IMBALANCE: ${discrepancyMinor} minor units discrepancy`,
    };
  }
}
