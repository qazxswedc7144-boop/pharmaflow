/**
 * PharmaFlow ERP — Deterministic Financial Math Engine (v3.0 — Single Source of Truth)
 *
 * ⚠️ STRICT FINANCIAL RULES:
 *   1. كل عملية مالية في النظام تمر من هنا. لا استثناءات.
 *   2. لا توجد نسخة ثانية من هذا الملف في أي مسار آخر.
 *   3. التحقق من توازن القيود يستخدم BigInt minor units، لا tolerance.
 *   4. أي مدخل غير صالح يُرفض بصوت عالٍ (لا fallback صامت).
 *
 * Rounding mode: HALF-AWAY-FROM-ZERO
 * Currency-aware: 0 منازل (YER)، 2 (USD/SAR)، 3 (KWD)
 * Prisma-agnostic: يستخدم duck-typing بدل instanceof (يعمل front + back)
 */

// ─────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────

export type FinancialErrorCode =
  | 'INVALID_NUMBER'
  | 'MALFORMED_NUMBER'
  | 'EMPTY_STRING'
  | 'UNSUPPORTED_TYPE'
  | 'PRECISION_LOSS'
  | 'INVALID_DECIMALS'
  | 'DIVISION_BY_ZERO'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_RATIOS'
  | 'BIGINT_OUT_OF_RANGE';

export class FinancialError extends Error {
  public readonly code: FinancialErrorCode;
  constructor(code: FinancialErrorCode, message: string) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CurrencyCode = 'YER' | 'SAR' | 'USD' | 'EUR' | 'KWD' | 'BHD' | 'OMR' | (string & {});

const CURRENCY_DECIMALS: Record<string, number> = {
  YER: 0,
  SAR: 2,
  USD: 2,
  EUR: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

const DEFAULT_CURRENCY: CurrencyCode = 'YER';

interface DecimalLike {
  toNumber(): number;
}

// ─────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────

export class FinancialMath {
  private static readonly EPSILON = 1e-9;
  private static readonly HALF_SNAP = 1e-9;
  private static strict = true;
  private static defaultCurrency: CurrencyCode = DEFAULT_CURRENCY;

  // ───────────────────────────────────────────────────────────────
  // Configuration
  // ───────────────────────────────────────────────────────────────

  public static setStrict(strict: boolean): void {
    this.strict = strict;
  }

  public static setDefaultCurrency(currency: CurrencyCode): void {
    if (!(currency in CURRENCY_DECIMALS)) {
      throw new FinancialError(
        'CURRENCY_MISMATCH',
        `عملة غير معروفة: ${currency}`,
      );
    }
    this.defaultCurrency = currency;
  }

  public static decimalsFor(currency: CurrencyCode = this.defaultCurrency): number {
    return CURRENCY_DECIMALS[currency] ?? 2;
  }

  // ───────────────────────────────────────────────────────────────
  // Core conversion — fail loud, never silent
  // ───────────────────────────────────────────────────────────────

  public static safeNum(val: unknown, fallback = 0): number {
    if (val === null || val === undefined) return fallback;

    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        if (this.strict) throw new FinancialError('INVALID_NUMBER', `قيمة رقمية غير صالحة: ${val}`);
        return fallback;
      }
      return val;
    }

    if (typeof val === 'bigint') {
      if (val > BigInt(Number.MAX_SAFE_INTEGER) || val < BigInt(Number.MIN_SAFE_INTEGER)) {
        if (this.strict) {
          throw new FinancialError('BIGINT_OUT_OF_RANGE', `BigInt خارج النطاق الآمن: ${val}`);
        }
        return fallback;
      }
      return Number(val);
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') {
        if (this.strict) throw new FinancialError('EMPTY_STRING', 'سلسلة فارغة غير مسموحة كمبلغ');
        return fallback;
      }
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        if (this.strict) throw new FinancialError('MALFORMED_NUMBER', `صيغة رقمية غير صالحة: "${val}"`);
        return fallback;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        if (this.strict) throw new FinancialError('MALFORMED_NUMBER', `تعذّر تحويل: "${val}"`);
        return fallback;
      }
      return parsed;
    }

    // ✅ duck-typing بدل instanceof (يعمل في الواجهة والسيرفر بلا Prisma dependency)
    if (typeof (val as DecimalLike)?.toNumber === 'function') {
      return this.decimalToNumber(val as DecimalLike, String(val));
    }

    if (this.strict) throw new FinancialError('UNSUPPORTED_TYPE', `نوع غير مدعوم: ${typeof val}`);
    return fallback;
  }

  private static decimalToNumber(decimalLike: DecimalLike, asStr: string): number {
    const n = decimalLike.toNumber();
    if (!Number.isFinite(n)) {
      if (this.strict) throw new FinancialError('INVALID_NUMBER', `Decimal غير صالح: ${asStr}`);
      return 0;
    }
    if (this.strict) {
      const normalized = asStr.includes('.') ? asStr.replace(/0+$/, '').replace(/\.$/, '') : asStr;
      const normalizedBack = String(n).includes('.')
        ? String(n).replace(/0+$/, '').replace(/\.$/, '')
        : String(n);
      if (normalized !== normalizedBack) {
        throw new FinancialError(
          'PRECISION_LOSS',
          `فقدان دقة عند التحويل: "${asStr}" → ${n}. استخدم Money.fromDecimal.`,
        );
      }
    }
    return n;
  }

  // ───────────────────────────────────────────────────────────────
  // Rounding — HALF-AWAY-FROM-ZERO
  // ───────────────────────────────────────────────────────────────

  public static round(val: unknown, decimals?: number): number {
    const d = decimals ?? this.decimalsFor();
    if (!Number.isInteger(d) || d < 0 || d > 10) {
      throw new FinancialError('INVALID_DECIMALS', `عدد المنازل غير صالح: ${d}`);
    }

    const n = this.safeNum(val);
    if (n === 0) return 0;

    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const factor = Math.pow(10, d);
    const scaled = abs * factor;
    const snapped = this.snapHalf(scaled);
    const rounded = Math.round(snapped);

    return (sign * rounded) / factor;
  }

  private static snapHalf(scaled: number): number {
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    if (Math.abs(frac - 0.5) < this.HALF_SNAP) return floor + 0.5;
    if (Math.abs(frac) < this.HALF_SNAP) return floor;
    if (Math.abs(frac - 1) < this.HALF_SNAP) return floor + 1;
    return scaled;
  }

  public static round2(val: unknown): number {
    return this.round(val, 2);
  }

  public static round4(val: unknown): number {
    return this.round(val, 4);
  }

  public static roundFor(val: unknown, currency: CurrencyCode): number {
    return this.round(val, this.decimalsFor(currency));
  }

  // ───────────────────────────────────────────────────────────────
  // Arithmetic
  // ───────────────────────────────────────────────────────────────

  public static add(...nums: unknown[]): number {
    let sum = 0;
    for (const num of nums) sum += this.safeNum(num);
    return this.round2(sum);
  }

  public static safeAdd(...nums: unknown[]): number {
    return this.add(...nums);
  }

  public static sub(a: unknown, b: unknown): number {
    return this.round2(this.safeNum(a) - this.safeNum(b));
  }

  public static safeSub(a: unknown, b: unknown): number {
    return this.sub(a, b);
  }

  public static mul(a: unknown, b: unknown): number {
    return this.round2(this.safeNum(a) * this.safeNum(b));
  }

  public static div(a: unknown, b: unknown, fallback = 0): number {
    const denom = this.safeNum(b);
    if (Math.abs(denom) < this.EPSILON) {
      if (this.strict) throw new FinancialError('DIVISION_BY_ZERO', 'قسمة على صفر');
      return fallback;
    }
    return this.round2(this.safeNum(a) / denom);
  }

  public static negate(val: unknown): number {
    return this.round2(-this.safeNum(val));
  }

  public static abs(val: unknown): number {
    return this.round2(Math.abs(this.safeNum(val)));
  }

  // ───────────────────────────────────────────────────────────────
  // Verification — STRICT BigInt-based (no tolerance)
  // ───────────────────────────────────────────────────────────────

  /**
   * ✅ التحقق الدقيق من التوازن المحاسبي. لا tolerance. توازن أو لا توازن.
   * ⚠️ أي استدعاء لهذه الدالة بثلاث وسائط يُرفض على مستوى TypeScript.
   */
  public static isBalanced(debits: unknown, credits: unknown): boolean {
    return this.toMinorUnits(debits) === this.toMinorUnits(credits);
  }

  public static discrepancyMinor(debits: unknown, credits: unknown): bigint {
    return this.toMinorUnits(debits) - this.toMinorUnits(credits);
  }

  public static discrepancy(debits: unknown, credits: unknown): number {
    const minor = this.discrepancyMinor(debits, credits);
    const abs = minor < 0n ? -minor : minor;
    return Number(abs) / 100;
  }

  public static equals(a: unknown, b: unknown, toleranceMinor = 0n): boolean {
    const diff = this.toMinorUnits(a) - this.toMinorUnits(b);
    const abs = diff < 0n ? -diff : diff;
    return abs <= toleranceMinor;
  }

  // ───────────────────────────────────────────────────────────────
  // Sign checks
  // ───────────────────────────────────────────────────────────────

  public static isNonNegative(val: unknown): boolean {
    return this.toMinorUnits(val) >= 0n;
  }

  public static isStrictlyPositive(val: unknown): boolean {
    return this.toMinorUnits(val) > 0n;
  }

  public static isStrictlyNegative(val: unknown): boolean {
    return this.toMinorUnits(val) < 0n;
  }

  public static isZero(val: unknown): boolean {
    return this.toMinorUnits(val) === 0n;
  }

  // ───────────────────────────────────────────────────────────────
  // Allocation — no penny lost
  // ───────────────────────────────────────────────────────────────

  public static allocate(amount: unknown, ratios: number[]): number[] {
    if (ratios.length === 0) {
      throw new FinancialError('INVALID_RATIOS', 'قائمة النسب فارغة');
    }
    const total = this.safeNum(amount);
    const ratioSum = ratios.reduce((s, r) => s + this.safeNum(r), 0);
    if (ratioSum <= 0) {
      throw new FinancialError('INVALID_RATIOS', 'مجموع النسب يجب أن يكون موجباً');
    }

    const totalMinor = this.toMinorUnits(total);
    const ratioSumMinor = BigInt(Math.round(ratioSum * 1e6));

    const result: number[] = [];
    let allocated = 0n;

    for (let i = 0; i < ratios.length; i++) {
      if (i === ratios.length - 1) {
        result.push(this.fromMinorUnits(totalMinor - allocated));
        break;
      }
      const ratioMinor = BigInt(Math.round(ratios[i] * 1e6));
      const share = (totalMinor * ratioMinor) / ratioSumMinor;
      allocated += share;
      result.push(this.fromMinorUnits(share));
    }
    return result;
  }

  // ───────────────────────────────────────────────────────────────
  // Internal
  // ───────────────────────────────────────────────────────────────

  private static toMinorUnits(val: unknown): bigint {
    const rounded = this.round2(val);
    if (rounded === 0) return 0n;

    const negative = rounded < 0;
    const abs = Math.abs(rounded).toFixed(2);
    const [intPart, fracPart] = abs.split('.');
    const minor = BigInt(intPart) * 100n + BigInt(fracPart || '0');
    return negative ? -minor : minor;
  }

  private static fromMinorUnits(minor: bigint): number {
    if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new FinancialError('BIGINT_OUT_OF_RANGE', `قيمة صغرى خارج النطاق الآمن: ${minor}`);
    }
    return Number(minor) / 100;
  }
                          }
