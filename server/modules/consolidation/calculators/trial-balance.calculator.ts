// server/modules/consolidation/calculators/trial-balance.calculator.ts
// Deterministic Consolidated Trial Balance with STRICT Debit == Credit Invariant
//
// ⚠️ STRICT MODE:
//   - لا tolerance. لا 0.05، لا 0.01، لا أي رقم آخر.
//   - الفرق يُحتسب بـ minor units (BigInt) ويُعرض للتدقيق.
//   - أي فرق ≠ 0 = فشل في الـ invariant.

import { randomUUID } from 'node:crypto';

import { FinancialMath } from '../financial-math';
import type { AggregatedLedgerState } from './ledger-balance.calculator';
import type {
  ConsolidatedTrialBalance,
  ConsolidatedTrialBalanceRow,
  EliminationRecord,
} from '../consolidation.types';

export class TrialBalanceCalculator {
  public static calculate(
    ledgerState: AggregatedLedgerState,
    _branches: Array<{ id: string; name: string }>,
    completedTransfers: any[] = [],
  ): ConsolidatedTrialBalance {
    const rows: ConsolidatedTrialBalanceRow[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    // ─────────────────────────────────────────────────────────
    // 1. بناء السطور من دفتر الأستاذ
    // ─────────────────────────────────────────────────────────
    for (const acct of ledgerState.accounts) {
      const isDebitPref = acct.balanceType === 'DEBIT';
      const net = isDebitPref
        ? FinancialMath.sub(acct.debit, acct.credit)
        : FinancialMath.sub(acct.credit, acct.debit);

      const branchBreakdowns: ConsolidatedTrialBalanceRow['branchBreakdowns'] = {};
      for (const [bId, br] of Object.entries(acct.branchBreakdowns)) {
        const brNet = isDebitPref
          ? FinancialMath.sub(br.debit, br.credit)
          : FinancialMath.sub(br.credit, br.debit);

        branchBreakdowns[bId] = {
          branchName: br.branchName,
          debit: br.debit,
          credit: br.credit,
          netBalance: brNet,
        };
      }

      rows.push({
        accountCode: acct.code,
        accountName: acct.name,
        accountType: acct.type,
        debit: acct.debit,
        credit: acct.credit,
        netBalance: net,
        balanceType: acct.balanceType,
        branchBreakdowns,
      });

      totalDebit = FinancialMath.add(totalDebit, acct.debit);
      totalCredit = FinancialMath.add(totalCredit, acct.credit);
    }

    // Sort rows deterministically by account code
    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    // ─────────────────────────────────────────────────────────
    // 2. تصفية الحركات الداخلية بين الفروع
    // ─────────────────────────────────────────────────────────
    const eliminations: EliminationRecord[] = [];
    for (const t of completedTransfers) {
      const tItems = t.items || [];
      let transferVal = 0;
      for (const item of tItems) {
        const q = FinancialMath.safeNum(item.qty ?? item.quantity);
        const c = FinancialMath.safeNum(
          item.costPrice ?? item.cost ?? item.price ?? 0,
        );
        transferVal = FinancialMath.add(
          transferVal,
          FinancialMath.mul(q, c),
        );
      }

      if (transferVal > 0) {
        eliminations.push({
          id: randomUUID(),
          type: 'INTERNAL_MOVEMENT',
          description: `Trial Balance elimination of internal inventory clearing for transfer ${t.transferNumber ?? t.id}`,
          amount: transferVal,
          referenceId: t.id,
          sourceId: t.sourceBranchId,
          targetId: t.targetBranchId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. ⚠️ STRICT INVARIANT: totalDebit === totalCredit بالضبط
    // ─────────────────────────────────────────────────────────
    // ❌ محذوف: tolerance 0.05 — كان يسمح بسرقة 5 هللات/سنتات بصمت
    // ✅ الآن: مقارنة BigInt minor units — صفر أو فشل
    const discrepancyMinor = FinancialMath.discrepancyMinor(
      totalDebit,
      totalCredit,
    );
    const isBalanced = discrepancyMinor === 0n;

    return {
      timestamp: new Date().toISOString(),
      rows,
      totalDebit,
      totalCredit,
      isBalanced,
      discrepancyMinor,
      discrepancyDisplay: Number(discrepancyMinor) / 100,
      eliminations,
    };
  }
}
