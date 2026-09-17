/**
 * PharmaFlow ERP — Safe Financial Advisory Pipeline & Unposted Proposal Service
 *
 * ⚠️ CORE ARCHITECTURAL INVARIANTS:
 *   1. AI CANNOT POST TO THE LEDGER DIRECTLY.
 *   2. التحقق من التوازن STRICT — BigInt minor units، لا tolerance.
 *   3. كل ID يُولَّد عبر crypto.randomUUID (غير قابل للتنبؤ).
 *   4. كل انتقال حالة يُسجَّل في Audit Trail.
 *
 * Flow:
 *   AI Analysis → Financial Recommendation → Unposted Proposal (Draft)
 *     → Validation (tenantId, auth, accounts, Debit == Credit STRICT)
 *     → Human Review (Accountant/Admin) → JournalPostingWorkflow
 *     → FinancialMath & Double-Entry Ledger → Audit Trail
 */

import { randomUUID } from 'node:crypto';
import { FinancialMath, FinancialError } from '@/core/financial-math';
import type { AIUserContext } from './types';
import { JournalPostingWorkflow } from '@/features/accounting/workflows/JournalPostingWorkflow';
import { WorkflowContextFactory } from '@/core/workflow/workflowContext';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ProposalType = 'JOURNAL_ENTRY' | 'ADJUSTMENT' | 'CORRECTION' | 'RECLASSIFICATION';
export type ProposalStatus = 'DRAFT_PENDING_REVIEW' | 'REJECTED' | 'APPROVED' | 'POSTED';

export interface ProposedJournalLine {
  lineId: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface ProposalValidationResult {
  isValid: boolean;
  errors: string[];
  validatedAt: string;
  totalDebit: number;
  totalCredit: number;
  /** فرق بوحدات العملة الكبرى — للعرض فقط */
  discrepancy: number;
  /** ⚠️ فرق فعلي بوحدات هللة — المرجع الحقيقي للقرارات */
  discrepancyMinor: bigint;
}

export interface UnpostedFinancialProposal {
  id: string;
  tenantId: string;
  branchId: string;
  correlationId: string;
  proposalType: ProposalType;
  title: string;
  description: string;
  reasoning: string;
  proposedDate: string;
  lines: ProposedJournalLine[];
  status: ProposalStatus;
  validation: ProposalValidationResult;
  sourceData?: {
    anomalyType?: string;
    sourceDocumentId?: string;
    originalAmount?: number;
    suggestedAdjustment?: number;
  };
  humanReview?: {
    reviewedBy?: string;
    reviewerRole?: string;
    reviewedAt?: string;
    decision?: 'APPROVED' | 'REJECTED';
    notes?: string;
  };
  postedJournalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────
// Audit Hook — يُستدعى عند كل انتقال حالة
// ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ هذا hook اختياري — إن لم يُمرَّر، لا يُسجَّل شيء.
 *    في الإنتاج يجب تمريره من طبقة الـ bootstrap.
 */
export type ProposalAuditHook = (event: {
  action:
    | 'PROPOSAL_CREATED'
    | 'PROPOSAL_REJECTED'
    | 'PROPOSAL_APPROVED'
    | 'PROPOSAL_POSTED'
    | 'PROPOSAL_POST_FAILED';
  proposalId: string;
  tenantId: string;
  actorId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  error?: string;
}) => Promise<void> | void;

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export class FinancialProposalService {
  /**
   * ⚠️ تخزين in-memory مؤقت — يُستبدل بـ Prisma repository في الإنتاج.
   *    يُستخدم للتطوير والاختبار فقط. في الإنتاج، استخدم `setStore()`.
   */
  private static proposals: Map<string, UnpostedFinancialProposal> = new Map();

  private static auditHook: ProposalAuditHook | null = null;

  // ───────────────────────────────────────────────────────────────
  // Configuration (يُمرَّر مرة واحدة عند bootstrap)
  // ───────────────────────────────────────────────────────────────

  public static setAuditHook(hook: ProposalAuditHook): void {
    this.auditHook = hook;
  }

  private static async emitAudit(
    event: Parameters<ProposalAuditHook>[0],
  ): Promise<void> {
    if (!this.auditHook) return;
    try {
      await this.auditHook(event);
    } catch (err) {
      // ⚠️ فشل audit لا يجب أن يوقف العملية المالية
      console.error(
        '[FinancialProposalService] audit hook failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Creation
  // ───────────────────────────────────────────────────────────────

  /**
   * ينشئ مقترحاً محاسبياً (Draft) من توصية AI.
   *
   * ⚠️ STRICT GUARANTEE: لا كتابة على دفتر الأستاذ، لا تأثير على الأرصدة أو المخزون.
   */
  public static async createProposalFromAI(
    creatorContext: AIUserContext,
    params: {
      proposalType: ProposalType;
      title: string;
      description: string;
      reasoning: string;
      proposedDate?: string;
      lines: Array<{
        accountId: string;
        accountCode?: string;
        accountName?: string;
        debit: number;
        credit: number;
        memo?: string;
      }>;
      sourceData?: UnpostedFinancialProposal['sourceData'];
      correlationId?: string;
    },
  ): Promise<UnpostedFinancialProposal> {
    // ✅ IDs غير قابلة للتنبؤ
    const correlationId =
      params.correlationId ?? `corr_ai_${randomUUID()}`;
    const proposalId = `prop_ai_${randomUUID()}`;
    const proposedDate =
      params.proposedDate ?? new Date().toISOString().substring(0, 10);

    const mappedLines: ProposedJournalLine[] = params.lines.map((l, idx) => ({
      lineId: `${proposalId}_line_${idx + 1}`,
      accountId: l.accountId,
      accountCode: l.accountCode ?? l.accountId,
      accountName: l.accountName ?? '',
      debit: FinancialMath.round2(l.debit ?? 0),
      credit: FinancialMath.round2(l.credit ?? 0),
      memo: l.memo ?? params.description,
    }));

    const validation = await this.validateProposalData({
      tenantId: creatorContext.tenantId,
      userRole: creatorContext.userRole,
      correlationId,
      lines: mappedLines,
    });

    const now = new Date().toISOString();

    const proposal: UnpostedFinancialProposal = {
      id: proposalId,
      tenantId: creatorContext.tenantId,
      branchId: creatorContext.branchId || 'MAIN_BRANCH',
      correlationId,
      proposalType: params.proposalType,
      title: params.title,
      description: params.description,
      reasoning: params.reasoning,
      proposedDate,
      lines: mappedLines,
      status: validation.isValid ? 'DRAFT_PENDING_REVIEW' : 'REJECTED',
      validation,
      sourceData: params.sourceData,
      createdAt: now,
      updatedAt: now,
    };

    this.proposals.set(proposal.id, proposal);

    // ✅ Audit — داخل الـ hook، لا يوقف العملية عند الفشل
    await this.emitAudit({
      action: 'PROPOSAL_CREATED',
      proposalId: proposal.id,
      tenantId: proposal.tenantId,
      actorId: creatorContext.userId,
      afterState: {
        status: proposal.status,
        proposalType: proposal.proposalType,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        discrepancyMinor: validation.discrepancyMinor.toString(),
      },
    });

    return proposal;
  }

  // ───────────────────────────────────────────────────────────────
  // Validation — STRICT
  // ───────────────────────────────────────────────────────────────

  public static async validateProposalData(params: {
    tenantId: string;
    userRole: string;
    correlationId: string;
    lines: ProposedJournalLine[];
    expectedTenantId?: string;
  }): Promise<ProposalValidationResult> {
    const errors: string[] = [];
    const validatedAt = new Date().toISOString();

    // 1. Tenant verification
    if (!params.tenantId || typeof params.tenantId !== 'string') {
      errors.push('معرف المنشأة (tenantId) مفقود أو غير صالح.');
    } else if (
      params.expectedTenantId &&
      params.tenantId !== params.expectedTenantId
    ) {
      errors.push('تعارض أمني: عدم تطابق معرف المنشأة (TENANT_MISMATCH).');
    }

    // 2. Correlation ID
    if (!params.correlationId) {
      errors.push('معرف التتبع (correlationId) إلزامي للتدقيق المالي.');
    }

    // 3. Role authorization
    const authorizedRoles = ['admin', 'accountant', 'manager'];
    if (!authorizedRoles.includes(params.userRole)) {
      errors.push('المستخدم غير مصرح له بإنشاء أو مراجعة توصيات محاسبية.');
    }

    // 4. Lines presence
    if (!params.lines || params.lines.length < 2) {
      errors.push(
        'القيد المحاسبي المقترح يجب أن يتضمن طرفين على الأقل (مدين ودائن).',
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    // 5. Line-level validation — عبر FinancialMath
    for (const [idx, line] of (params.lines ?? []).entries()) {
      const lineNo = idx + 1;

      if (!line.accountId || line.accountId.trim() === '') {
        errors.push(`السطر ${lineNo}: يجب تحديد حساب محاسبي صالح.`);
      }

      const debit = FinancialMath.safeNum(line.debit, 0);
      const credit = FinancialMath.safeNum(line.credit, 0);

      if (debit < 0 || credit < 0) {
        errors.push(
          `السطر ${lineNo}: المبالغ يجب أن تكون موجبة ` +
          `(لا يُقبل المدين أو الدائن السالب).`,
        );
      }

      if (FinancialMath.isZero(debit) && FinancialMath.isZero(credit)) {
        errors.push(`السطر ${lineNo}: يجب أن يحتوي على قيمة في المدين أو الدائن.`);
      }

      if (
        FinancialMath.isStrictlyPositive(debit) &&
        FinancialMath.isStrictlyPositive(credit)
      ) {
        errors.push(
          `السطر ${lineNo}: لا يمكن أن يكون السطر الواحد مديناً ودائناً في نفس الوقت.`,
        );
      }

      totalDebit = FinancialMath.add(totalDebit, debit);
      totalCredit = FinancialMath.add(totalCredit, credit);
    }

    // 6. ⚠️ STRICT BALANCE — BigInt minor units
    // ❌ محذوف: isBalanced(totalDebit, totalCredit, 0.001)
    // ✅ الآن: مطابقة دقيقة — صفر أو فشل
    const discrepancyMinor = FinancialMath.discrepancyMinor(
      totalDebit,
      totalCredit,
    );
    const isBalanced = discrepancyMinor === 0n;
    const discrepancy = Number(
      discrepancyMinor < 0n ? -discrepancyMinor : discrepancyMinor,
    ) / 100;

    if (!isBalanced) {
      errors.push(
        `القيد المقترح غير متزن محاسبياً! ` +
        `مجموع المدين (${totalDebit.toFixed(2)}) ≠ مجموع الدائن (${totalCredit.toFixed(2)}). ` +
        `الفارق: ${discrepancy} (${discrepancyMinor} هللة).`,
      );
    }

    if (
      !FinancialMath.isStrictlyPositive(totalDebit) ||
      !FinancialMath.isStrictlyPositive(totalCredit)
    ) {
      errors.push('إجمالي قيمة القيد يجب أن يكون أكبر من الصفر.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedAt,
      totalDebit,
      totalCredit,
      discrepancy,
      discrepancyMinor,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Approval + Posting Gate
  // ───────────────────────────────────────────────────────────────

  public static async approveAndPostProposal(
    proposalId: string,
    reviewerContext: AIUserContext,
    reviewDecision: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ): Promise<{
    success: boolean;
    proposal: UnpostedFinancialProposal | null;
    journalId?: string;
    error?: string;
  }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return {
        success: false,
        proposal: null,
        error: `المقترح المحاسبي غير موجود: ${proposalId}`,
      };
    }

    // Tenant isolation
    if (reviewerContext.tenantId !== proposal.tenantId) {
      return {
        success: false,
        proposal,
        error:
          'رفض أمني: معرف المنشأة للمراجع لا يطابق المنشأة المالكة للمقترح (TENANT_MISMATCH).',
      };
    }

    // Approver role
    if (!['admin', 'accountant'].includes(reviewerContext.userRole)) {
      return {
        success: false,
        proposal,
        error:
          'المستخدم غير مفوض بالموافقة على القيود المحاسبية وترحيلها (مطلوب محاسب أو مدير نظام).',
      };
    }

    const now = new Date().toISOString();

    // ── Rejection path ──
    if (reviewDecision === 'REJECTED') {
      const beforeState = { status: proposal.status };
      proposal.status = 'REJECTED';
      proposal.humanReview = {
        reviewedBy: reviewerContext.userId,
        reviewerRole: reviewerContext.userRole,
        reviewedAt: now,
        decision: 'REJECTED',
        notes: reviewNotes || 'تم رفض المقترح من قبل المراجع البشري.',
      };
      proposal.updatedAt = now;
      this.proposals.set(proposal.id, proposal);

      await this.emitAudit({
        action: 'PROPOSAL_REJECTED',
        proposalId: proposal.id,
        tenantId: proposal.tenantId,
        actorId: reviewerContext.userId,
        beforeState,
        afterState: { status: 'REJECTED' },
      });

      return { success: true, proposal };
    }

    // ── Re-validation before posting ──
    const validationCheck = await this.validateProposalData({
      tenantId: reviewerContext.tenantId,
      userRole: reviewerContext.userRole,
      correlationId: proposal.correlationId,
      lines: proposal.lines,
      expectedTenantId: proposal.tenantId,
    });

    if (!validationCheck.isValid) {
      const beforeState = { status: proposal.status, isValid: true };
      proposal.status = 'REJECTED';
      proposal.validation = validationCheck;
      proposal.updatedAt = now;
      this.proposals.set(proposal.id, proposal);

      await this.emitAudit({
        action: 'PROPOSAL_REJECTED',
        proposalId: proposal.id,
        tenantId: proposal.tenantId,
        actorId: reviewerContext.userId,
        beforeState,
        afterState: {
          status: 'REJECTED',
          errors: validationCheck.errors,
        },
      });

      return {
        success: false,
        proposal,
        error: `فشل التحقق المحاسبي قبل الترحيل: ${validationCheck.errors.join(' | ')}`,
      };
    }

    // ── Posting through the workflow ──
    try {
      const workflow = new JournalPostingWorkflow();
      const postingResult = await workflow.executeDomainSteps(
        {
          date: proposal.proposedDate,
          description: `[ترحيل معتمد من توصية AI] ${proposal.title} - ${proposal.description}`,
          reference: proposal.correlationId,
          lines: proposal.lines.map((l) => ({
            accountId: l.accountId,
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo,
          })),
        },
        WorkflowContextFactory.create('JOURNAL_POSTING', {
          workflowId: workflow.id,
          idempotencyKey: proposal.correlationId,
          userId: reviewerContext.userId,
          tenantId: reviewerContext.tenantId,
          branchId: reviewerContext.branchId,
          correlationId: proposal.correlationId,
        }),
      );

      const beforeState = { status: proposal.status };
      proposal.status = 'POSTED';
      proposal.postedJournalId = postingResult.journalId;
      proposal.humanReview = {
        reviewedBy: reviewerContext.userId,
        reviewerRole: reviewerContext.userRole,
        reviewedAt: now,
        decision: 'APPROVED',
        notes: reviewNotes || 'تمت المراجعة والاعتماد والموافقة على الترحيل.',
      };
      proposal.updatedAt = now;
      this.proposals.set(proposal.id, proposal);

      await this.emitAudit({
        action: 'PROPOSAL_POSTED',
        proposalId: proposal.id,
        tenantId: proposal.tenantId,
        actorId: reviewerContext.userId,
        beforeState,
        afterState: {
          status: 'POSTED',
          journalId: postingResult.journalId,
        },
      });

      return {
        success: true,
        proposal,
        journalId: postingResult.journalId,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      await this.emitAudit({
        action: 'PROPOSAL_POST_FAILED',
        proposalId: proposal.id,
        tenantId: proposal.tenantId,
        actorId: reviewerContext.userId,
        error: message,
      });

      return {
        success: false,
        proposal,
        error: `فشل ترحيل القيد عبر المحرك المحاسبي: ${message}`,
      };
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Review wrapper
  // ───────────────────────────────────────────────────────────────

  public static async reviewProposal(
    proposalId: string,
    reviewerContext: AIUserContext,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string,
  ): Promise<UnpostedFinancialProposal> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`المقترح المحاسبي غير موجود: ${proposalId}`);
    }

    if (reviewerContext.tenantId !== proposal.tenantId) {
      throw new Error(
        'المستخدم لا يملك صلاحية المراجعة لحساب منشأة مختلفة (TENANT_MISMATCH)',
      );
    }

    if (decision === 'APPROVED') {
      if (!proposal.validation.isValid || proposal.status === 'REJECTED') {
        throw new Error('لا يمكن اعتماد مقترح غير صالح أو غير متزن محاسبياً.');
      }
    }

    const res = await this.approveAndPostProposal(
      proposalId,
      reviewerContext,
      decision,
      notes,
    );
    if (!res.success || !res.proposal) {
      throw new Error(res.error ?? 'فشلت عملية مراجعة واعتماد المقترح.');
    }

    return res.proposal;
  }

  // ───────────────────────────────────────────────────────────────
  // Retrieval — مع تمييز الحوادث الأمنية
  // ───────────────────────────────────────────────────────────────

  /**
   * ⚠️ يُميِّز بين "not found" و "tenant mismatch":
   *   - `null` → not found
   *   - يرمي `FinancialError` → tenant mismatch (حادثة أمنية تُسجَّل)
   */
  public static getProposalById(
    proposalId: string,
    tenantId: string,
  ): UnpostedFinancialProposal | null {
    const prop = this.proposals.get(proposalId);
    if (!prop) return null;

    if (prop.tenantId !== tenantId) {
      // ✅ لا نخفي الحادثة الأمنية — نرمي خطأ
      throw new FinancialError(
        'CURRENCY_MISMATCH', // placeholder — استبدله بـ 'TENANT_MISMATCH' إن أضفتها للـ enum
        `TENANT_MISMATCH: proposal ${proposalId} belongs to a different tenant.`,
      );
    }
    return prop;
  }

  public static listProposals(
    tenantId: string,
    status?: ProposalStatus,
  ): UnpostedFinancialProposal[] {
    const list: UnpostedFinancialProposal[] = [];
    for (const prop of this.proposals.values()) {
      if (prop.tenantId === tenantId && (!status || prop.status === status)) {
        list.push(prop);
      }
    }
    return list;
  }

  /**
   * يُستخدم للاختبارات المعزولة فقط.
   */
  public static _clearForTesting(): void {
    this.proposals.clear();
    this.auditHook = null;
  }
    }
