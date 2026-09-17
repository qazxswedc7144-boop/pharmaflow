/**
 * PharmaFlow ERP — Financial Grounding & Number Verification Engine
 *
 * يقارن الأرقام المالية الناتجة من الذكاء الاصطناعي مقابل مقاييس دفتر الأستاذ
 * المعتمدة من AccountingContextAdapter.
 *
 * ⚠️ CORE RULE:
 *   - الذكاء الاصطناعي ليس مصدر الحقيقة المالية. دفتر الأستاذ هو المصدر.
 *   - المطابقة STRICT: صفر tolerance. أي فرق ≠ 0 = UNVERIFIED_AI_CLAIM.
 *   - كل مقارنة تمر من FinancialMath (BigInt minor units).
 */

import type { FinancialContextData } from './types';
import { FinancialMath } from '@/core/financial-math';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ClaimVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED_AI_CLAIM'
  | 'NO_GROUNDING_DATA';

export interface FinancialClaimVerification {
  metricKey: string;
  metricLabelArabic: string;
  claimedValue: number;
  authoritativeValue: number;
  status: ClaimVerificationStatus;
  /** فرق مطلق بوحدات العملة الكبرى — للعرض */
  discrepancy: number;
  /** ⚠️ فرق فعلي بوحدات هللة — المرجع الحقيقي للقرارات */
  discrepancyMinor: bigint;
  /** نسبة الفرق % (سالبة أو موجبة) — للعرض */
  percentageDiff: number;
  isMatch: boolean;
}

export interface GroundingVerificationResult {
  isGrounded: boolean;
  claims: FinancialClaimVerification[];
  flaggedClaims: FinancialClaimVerification[];
  summaryStatus: 'VERIFIED' | 'DISCREPANCY_DETECTED' | 'NO_FINANCIAL_CLAIMS';
  groundedText: string;
  discrepancyCount: number;
}

interface MetricSpec {
  metricKey: string;
  metricLabelArabic: string;
  regex: RegExp;
  valueOf: (ctx: FinancialContextData | Record<string, any>) => number | undefined;
}

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export class FinancialGroundingService {
  /**
   * يقيم النص الناتج من الذكاء الاصطناعي مقابل السياق المالي المعتمد.
   * ⚠️ المطابقة صارمة — لا tolerance.
   */
  public static verifyFinancialText(
    aiText: string,
    authoritativeContext?: FinancialContextData | Record<string, any>,
  ): GroundingVerificationResult {
    if (!aiText || typeof aiText !== 'string') {
      return this.emptyResult('');
    }

    if (!authoritativeContext) {
      return this.emptyResult(aiText);
    }

    const claims: FinancialClaimVerification[] = [];
    const specs = this.buildMetricSpecs();

    for (const spec of specs) {
      const authValue = spec.valueOf(authoritativeContext);
      if (authValue === undefined || authValue === null) continue;

      this.extractAndVerify(
        aiText,
        spec.regex,
        authValue,
        spec.metricKey,
        spec.metricLabelArabic,
        claims,
      );
    }

    const discrepancies = claims.filter((c) => c.status === 'UNVERIFIED_AI_CLAIM');
    const isGrounded = discrepancies.length === 0;

    let summaryStatus: GroundingVerificationResult['summaryStatus'] =
      'NO_FINANCIAL_CLAIMS';
    if (claims.length > 0) {
      summaryStatus = isGrounded ? 'VERIFIED' : 'DISCREPANCY_DETECTED';
    }

    let groundedText = aiText;
    if (!isGrounded) {
      const warningLines = discrepancies.map(
        (d) =>
          `• ${d.metricLabelArabic}: الرقم المذكور (${d.claimedValue.toLocaleString('ar-EG')}) ` +
          `غير مطابق لدفتر الأستاذ الرسمي (المعتمد: ${d.authoritativeValue.toLocaleString('ar-EG')}). ` +
          `الفرق: ${Number(d.discrepancyMinor) / 100} هللة.`,
      );

      groundedText +=
        `\n\n---\n` +
        `**⚠️ تنبيه تدقيق محاسبي للأرقام المالية (UNVERIFIED_AI_CLAIM):**\n` +
        `تم رصد تباين بين الأرقام الاسترشادية ومصدر الحقيقة المالي المعتمد في دفتر الأستاذ:\n` +
        warningLines.join('\n') +
        `\n*القاعدة المحاسبية: محرك الحسابات ودفاتر الأستاذ العام هي المصدر الحصري للحقيقة المالية.*`;
    }

    return {
      isGrounded,
      claims,
      flaggedClaims: discrepancies,
      summaryStatus,
      groundedText,
      discrepancyCount: discrepancies.length,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Metric specifications
  // ───────────────────────────────────────────────────────────────

  private static buildMetricSpecs(): MetricSpec[] {
    const pickFirst = (
      ctx: FinancialContextData | Record<string, any>,
      keys: string[],
    ): number | undefined => {
      const c = ctx as Record<string, any>;
      for (const k of keys) {
        const v = c[k];
        if (v !== undefined && v !== null) return FinancialMath.safeNum(v);
      }
      return undefined;
    };

    return [
      {
        metricKey: 'revenue',
        metricLabelArabic: 'الإيرادات والمبيعات',
        regex:
          /(?:المبيعات|الإيرادات|إجمالي المبيعات|revenue|sales)\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) => pickFirst(ctx, ['revenue', 'totalRevenue']),
      },
      {
        metricKey: 'netProfit',
        metricLabelArabic: 'صافي الربح',
        regex:
          /(?:صافي الربح|الأرباح الصافية|صافي الدخل|إجمالي الأرباح|الأرباح|net profit|net income)\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) => pickFirst(ctx, ['netProfit', 'netIncome']),
      },
      {
        metricKey: 'totalAccountsReceivable',
        metricLabelArabic: 'الذمم المدينة (مستحقات العملاء)',
        regex:
          /(?:الذمم المدينة|مستحقات العملاء|ديون العملاء|accounts receivable|receivables)\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) =>
          pickFirst(ctx, ['totalAccountsReceivable', 'totalReceivables']),
      },
      {
        metricKey: 'totalAccountsPayable',
        metricLabelArabic: 'الذمم الدائنة (مستحقات الموردين)',
        regex:
          /(?:الذمم الدائنة|مستحقات الموردين|ديون الموردين|accounts payable|payables)\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) =>
          pickFirst(ctx, ['totalAccountsPayable', 'totalPayables']),
      },
      {
        metricKey: 'cogs',
        metricLabelArabic: 'تكلفة المبيعات',
        regex:
          /(?:تكلفة المبيعات|تكلفة البضاعة المباعة|cogs|cost of goods sold)\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) => pickFirst(ctx, ['cogs', 'costOfGoodsSold']),
      },
      {
        metricKey: 'totalCash',
        metricLabelArabic: 'رصيد النقدية في الصندوق',
        regex:
          /(?:النقدية|رصيد الصندوق|النقد في الصندوق|رصيد النقدية|الصندوق|كاش|cash|treasury)\s*(?:في الصندوق|بالخزينة)?\s*(?:=|هو|تبلغ|بلغت|:)?\s*([0-9,]+(?:\.[0-9]+)?)/gi,
        valueOf: (ctx) => pickFirst(ctx, ['totalCash', 'cash', 'treasury']),
      },
    ];
  }

  // ───────────────────────────────────────────────────────────────
  // Extraction + STRICT verification
  // ───────────────────────────────────────────────────────────────

  private static extractAndVerify(
    text: string,
    regex: RegExp,
    authoritativeVal: number,
    metricKey: string,
    metricLabelArabic: string,
    claimsList: FinancialClaimVerification[],
  ): void {
    // ⚠️ نُنشئ regex جديداً لكل استدعاء لتجنب lastIndex bugs
    const re = new RegExp(regex.source, regex.flags);

    const authNum = FinancialMath.safeNum(authoritativeVal);

    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const rawNumStr = (match[1] ?? match[0]).replace(/,/g, '');

      // ✅ نستخدم FinancialMath لتحويل آمن — يرفض القيم الملوثة
      let claimedNum: number;
      try {
        claimedNum = FinancialMath.safeNum(rawNumStr, NaN);
      } catch {
        continue; // تجاهل الأرقام الملوثة — لا نوقف التحقق كله
      }
      if (!Number.isFinite(claimedNum)) continue;

      // ═══════════════════════════════════════════════════════
      // ⚠️ STRICT MATCH — لا tolerance، لا 1.0، لا 1%
      // ═══════════════════════════════════════════════════════
      // ❌ محذوف: Math.max(1.0, authNum * 0.01)
      // ✅ الآن: BigInt minor units — مطابقة دقيقة
      const discrepancyMinor = FinancialMath.discrepancyMinor(
        claimedNum,
        authNum,
      );
      const isMatch = discrepancyMinor === 0n;

      const discrepancyAbs =
        discrepancyMinor < 0n ? -discrepancyMinor : discrepancyMinor;
      const discrepancy = Number(discrepancyAbs) / 100;

      // النسبة — دقيقة عبر minor units
      let percentageDiff = 0;
      const authMinor = FinancialMath.discrepancyMinor(authNum, 0);
      if (authMinor !== 0n) {
        percentageDiff =
          Number((discrepancyAbs * 10000n) / (authMinor < 0n ? -authMinor : authMinor)) / 100;
      } else if (claimedNum !== 0) {
        percentageDiff = 100;
      }

      claimsList.push({
        metricKey,
        metricLabelArabic,
        claimedValue: claimedNum,
        authoritativeValue: authNum,
        status: isMatch ? 'VERIFIED' : 'UNVERIFIED_AI_CLAIM',
        discrepancy,
        discrepancyMinor: discrepancyAbs,
        percentageDiff: FinancialMath.round2(percentageDiff),
        isMatch,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────

  private static emptyResult(
    text: string,
  ): GroundingVerificationResult {
    return {
      isGrounded: true,
      claims: [],
      flaggedClaims: [],
      summaryStatus: 'NO_FINANCIAL_CLAIMS',
      groundedText: text,
      discrepancyCount: 0,
    };
  }
}
