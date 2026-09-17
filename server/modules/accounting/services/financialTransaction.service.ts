// server/modules/accounting/services/financialTransaction.service.ts
//
// ⚠️ STRICT FINANCIAL POSTING:
//   - قفل الفاتورة والتحقق من الحالة داخل transaction + FOR UPDATE.
//   - لا tolerance في التحقق من التوازن — BigInt minor units.
//   - كل التراكمات المالية تمر من FinancialMath.
//   - كل كتابة audit داخل نفس transaction الناجحة.

import { Prisma, InvoiceStatus, DocumentStatus, InvoiceType } from '@prisma/client';
import { runInTransaction } from '../../../core/database/transactionGuard';
import { FifoService } from '../../inventory/services/fifo.service';
import { prisma } from '../../../database/prisma';
import { FinancialMath, FinancialError } from '../../../../src/core/financial-math';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface LedgerLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

interface PostResult {
  success: true;
  journalId: string;
  invoiceNumber: string;
  cogs: number;
}

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export class FinancialTransactionService {
  /**
   * يجلب أو ينشئ حساباً محاسبياً بنظام التشغيل.
   * يعمل داخل transaction العميل.
   */
  private static async getOrCreateAccount(
    tx: Prisma.TransactionClient,
    code: string,
    name: string,
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
  ) {
    let account = await tx.account.findUnique({ where: { code } });
    if (!account) {
      account = await tx.account.create({
        data: { code, name, type, isSystem: true, balance: 0.0 },
      });
    }
    return account;
  }

  /**
   * ترحيل فاتورة (مبيعات/مشتريات) إلى دفتر الأستاذ العام.
   *
   * ضمانات ذرّية:
   *   1. قفل صفّي على الفاتورة (FOR UPDATE) قبل أي فحص أو تعديل.
   *   2. التحقق من الحالة داخل القفل — يمنع POST مزدوج من نافذتين.
   *   3. كل تراكم مالي عبر FinancialMath.
   *   4. التحقق من التوازن بـ BigInt minor units — لا tolerance.
   *   5. Audit Log داخل نفس الـ transaction — يُلغى مع الفشل.
   */
  static async postInvoiceToLedger(
    invoiceId: string,
    userId: string | null = null,
    ipAddress: string | null = null,
  ): Promise<PostResult> {
    try {
      return await runInTransaction('AccountingService', async (tx) => {
        // ═══════════════════════════════════════════════════════
        // 1. قفل الفاتورة (FOR UPDATE) قبل أي قراءة أو تعديل
        // ═══════════════════════════════════════════════════════
        const invoiceLockRows = await tx.$queryRaw<
          Array<{ id: string; status: string; documentStatus: string }>
        >`
          SELECT id, status, "documentStatus"
            FROM "Invoice"
           WHERE id = ${invoiceId}
           FOR UPDATE
        `;

        if (invoiceLockRows.length === 0) {
          throw new FinancialError(
            'INVOICE_NOT_FOUND',
            `INVOICE_NOT_FOUND: Invoice ID ${invoiceId} doesn't exist.`,
          );
        }

        const lock = invoiceLockRows[0];

        // ✅ الفحص الآن داخل القفل — لا race condition ممكن
        if (lock.documentStatus === 'POSTED' || lock.status === 'CONFIRMED') {
          throw new FinancialError(
            'ALREADY_POSTED',
            `ALREADY_POSTED: Invoice ${invoiceId} is already posted ` +
              `(status=${lock.status}, documentStatus=${lock.documentStatus}).`,
          );
        }

        // 2. الآن نجلب الفاتورة كاملة بعد ضمان القفل
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { items: { include: { product: true } } },
        });

        if (!invoice) {
          // نظرياً مستحيل بعد القفل، لكن للأمان
          throw new FinancialError(
            'INVOICE_NOT_FOUND',
            `INVOICE_NOT_FOUND: Invoice ID ${invoiceId} vanished after lock.`,
          );
        }

        // 3. مبلغ الفاتورة الكلي — عبر FinancialMath (BigInt minor units)
        const totalInvoiceAmount = FinancialMath.safeNum(invoice.totalAmount);

        // ✅ فحص نوع الدفع بدون as any
        const isCash =
          invoice.paymentStatus === 'PAID' ||
          String(invoice.paymentStatus) === 'CASH';

        // ═══════════════════════════════════════════════════════
        // 4. الحسابات الأساسية + قفلها
        // ═══════════════════════════════════════════════════════
        const cashAcc = await this.getOrCreateAccount(tx, '101001', 'الصندوق والبنك (النقدية)', 'ASSET');
        const arAcc   = await this.getOrCreateAccount(tx, '101002', 'ذمم مدينة عملاء', 'ASSET');
        const invAcc  = await this.getOrCreateAccount(tx, '101003', 'مخزون الأدوية والمواد الطبية', 'ASSET');
        const revAcc  = await this.getOrCreateAccount(tx, '401001', 'إيرادات المبيعات الدوائية', 'REVENUE');
        const cogsAcc = await this.getOrCreateAccount(tx, '501001', 'تكلفة المبيعات (COGS)', 'EXPENSE');
        const apAcc   = await this.getOrCreateAccount(tx, '201001', 'ذمم دائنة موردين', 'LIABILITY');

        const accountIdsToLock = [
          cashAcc.id,
          arAcc.id,
          invAcc.id,
          revAcc.id,
          cogsAcc.id,
          apAcc.id,
        ];
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "Account" WHERE id IN (${Prisma.join(accountIdsToLock)}) FOR UPDATE`,
        );

        // ═══════════════════════════════════════════════════════
        // 5. بناء سطور القيد
        // ═══════════════════════════════════════════════════════
        let totalComputatedCogs = 0;
        const ledgerLines: LedgerLineInput[] = [];

        const invoiceSnapshotBefore = JSON.stringify({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          documentStatus: invoice.documentStatus,
          totalAmount: invoice.totalAmount?.toString?.() ?? invoice.totalAmount,
        });

        // ─────────────────────────────────────────────────
        // 5a. مبيعات (SALE)
        // ─────────────────────────────────────────────────
        if (invoice.type === InvoiceType.SALE) {
          for (const item of invoice.items) {
            if (!item.productId) continue;

            const fifoResult = await FifoService.depleteStock(
              tx,
              item.productId,
              item.qty,
              invoice.id,
              'INVOICE',
              `صرف مبيعات - فاتورة #${invoice.invoiceNumber}`,
            );

            totalComputatedCogs = FinancialMath.add(
              totalComputatedCogs,
              fifoResult.totalCost,
            );

            // تحديث تكلفة السطر — بدون قسمة على صفر
            const unitCost = item.qty > 0
              ? FinancialMath.div(fifoResult.totalCost, item.qty)
              : 0;

            await tx.invoiceItem.update({
              where: { id: item.id },
              data: { cost: unitCost },
            });
          }

          // مدين: نقدية أو ذمم عملاء
          if (isCash) {
            ledgerLines.push({
              accountId: cashAcc.id,
              debit: totalInvoiceAmount,
              credit: 0,
              description: `نقدية مبيعات فاتورة #${invoice.invoiceNumber}`,
            });
          } else {
            ledgerLines.push({
              accountId: arAcc.id,
              debit: totalInvoiceAmount,
              credit: 0,
              description: `آجل مبيعات فاتورة #${invoice.invoiceNumber}`,
            });
          }

          // دائن: إيرادات
          ledgerLines.push({
            accountId: revAcc.id,
            debit: 0,
            credit: totalInvoiceAmount,
            description: `مبيعات فاتورة #${invoice.invoiceNumber}`,
          });

          // COGS: مدين تكلفة، دائن مخزون
          if (FinancialMath.isStrictlyPositive(totalComputatedCogs)) {
            ledgerLines.push({
              accountId: cogsAcc.id,
              debit: totalComputatedCogs,
              credit: 0,
              description: `تكلفة مبيعات فاتورة #${invoice.invoiceNumber}`,
            });
            ledgerLines.push({
              accountId: invAcc.id,
              debit: 0,
              credit: totalComputatedCogs,
              description: `انخفاض المخزون مبيعات فاتورة #${invoice.invoiceNumber}`,
            });
          }
        }

        // ─────────────────────────────────────────────────
        // 5b. مشتريات (PURCHASE)
        // ─────────────────────────────────────────────────
        else if (invoice.type === InvoiceType.PURCHASE) {
          for (const item of invoice.items) {
            const batchNumber = item.note || `BATCH-${Date.now()}-${item.id}`;
            await FifoService.addStock(
              tx,
              item.productId,
              batchNumber,
              item.qty,
              Number(item.price),
              item.expiryDate,
              invoice.id,
              'INVOICE',
              `توريد مشتريات - فاتورة #${invoice.invoiceNumber}`,
            );
          }

          // مدين: مخزون
          ledgerLines.push({
            accountId: invAcc.id,
            debit: totalInvoiceAmount,
            credit: 0,
            description: `زيادة مخزون مشتريات فاتورة #${invoice.invoiceNumber}`,
          });

          // دائن: نقدية أو ذمم موردين
          if (isCash) {
            ledgerLines.push({
              accountId: cashAcc.id,
              debit: 0,
              credit: totalInvoiceAmount,
              description: `نقدية مشتريات فاتورة #${invoice.invoiceNumber}`,
            });
          } else {
            ledgerLines.push({
              accountId: apAcc.id,
              debit: 0,
              credit: totalInvoiceAmount,
              description: `آجل مشتريات فاتورة #${invoice.invoiceNumber}`,
            });
          }
        }

        // ─────────────────────────────────────────────────
        // 5c. نوع غير مدعوم
        // ─────────────────────────────────────────────────
        else {
          throw new FinancialError(
            'UNSUPPORTED_TYPE',
            `UNSUPPORTED_TYPE: Invoice type ${invoice.type} is not yet supported.`,
          );
        }

        // ═══════════════════════════════════════════════════════
        // 6. ⚠️ STRICT DOUBLE-ENTRY ENFORCEMENT
        // ═══════════════════════════════════════════════════════
        // ❌ محذوف: Math.abs(...) > 0.0001 — كان يقبل drift float
        // ✅ الآن: BigInt minor units — صفر أو فشل
        const sumDebits = FinancialMath.add(
          ...ledgerLines.map((l) => l.debit),
        );
        const sumCredits = FinancialMath.add(
          ...ledgerLines.map((l) => l.credit),
        );

        const discrepancyMinor = FinancialMath.discrepancyMinor(
          sumDebits,
          sumCredits,
        );

        if (discrepancyMinor !== 0n) {
          throw new FinancialError(
            'UNBALANCED_ENTRY',
            `UNBALANCED_ENTRY: Financial posting aborted. ` +
              `Debits=${sumDebits}, Credits=${sumCredits}, ` +
              `Discrepancy=${discrepancyMinor} minor units.`,
          );
        }

        // ═══════════════════════════════════════════════════════
        // 7. إنشاء قيد اليومية
        // ═══════════════════════════════════════════════════════
        const journalEntry = await tx.journalEntry.create({
          data: {
            date: invoice.date,
            sourceId: invoice.id,
            sourceType: 'INVOICE',
            referenceId: invoice.invoiceNumber,
            status: 'POSTED',
            description:
              `قيد ترحيل آلي لفاتورة ` +
              `${invoice.type === 'SALE' ? 'مبيعات' : 'مشتريات'} ` +
              `رقم #${invoice.invoiceNumber}`,
            debitTotal: sumDebits,
            creditTotal: sumCredits,
            lines: {
              create: ledgerLines.map((line) => ({
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                description: line.description,
              })),
            },
          },
        });

        // ═══════════════════════════════════════════════════════
        // 8. تحديث أرصدة الحسابات
        //    (الحسابات مقفلة بـ FOR UPDATE في الخطوة 4)
        // ═══════════════════════════════════════════════════════
        for (const line of ledgerLines) {
          const adjustment = FinancialMath.sub(line.debit, line.credit);

          // ✅ increment ذرّي على مستوى SQL — لا يحتاج optimistic lock
          await tx.account.update({
            where: { id: line.accountId },
            data: {
              balance: { increment: adjustment },
              version: { increment: 1 },
            },
          });
        }

        // ═══════════════════════════════════════════════════════
        // 9. تحديث حالة الفاتورة
        // ═══════════════════════════════════════════════════════
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id, documentStatus: 'DRAFT' }, // guard إضافي
          data: {
            status: InvoiceStatus.CONFIRMED,
            documentStatus: DocumentStatus.POSTED,
          },
        });

        // ═══════════════════════════════════════════════════════
        // 10. Audit Trail — داخل نفس الـ transaction
        // ═══════════════════════════════════════════════════════
        const invoiceSnapshotAfter = JSON.stringify({
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          status: updatedInvoice.status,
          documentStatus: updatedInvoice.documentStatus,
          journalEntryId: journalEntry.id,
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'POST_JOURNAL',
            entity: 'Invoice',
            entityId: invoiceId,
            before: invoiceSnapshotBefore,
            after: invoiceSnapshotAfter,
            ipAddress,
          },
        });

        return {
          success: true as const,
          journalId: journalEntry.id,
          invoiceNumber: invoice.invoiceNumber,
          cogs: totalComputatedCogs,
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // ─────────────────────────────────────────────────────
      // Best-effort audit خارج الـ transaction للفشل
      // ⚠️ لا يوقف تنفيذ الفشل — الأهم إعادة رمي الخطأ الأصلي
      // ─────────────────────────────────────────────────────
      if (
        message.includes('INSUFFICIENT_STOCK') ||
        message.includes('FIFO_DEPLETION_MISMATCH') ||
        message.includes('INVENTORY_ALLOCATION_FAILED')
      ) {
        try {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'INVENTORY_ALLOCATION_FAILED',
              entity: 'Invoice',
              entityId: invoiceId,
              before: JSON.stringify({ error: message }),
              after: null,
              ipAddress,
            },
          });
        } catch (auditErr) {
          console.error(
            'Failed to write INVENTORY_ALLOCATION_FAILED audit log:',
            auditErr instanceof Error ? auditErr.message : String(auditErr),
          );
        }
      }

      // ✅ إعادة رمي الخطأ الأصلي دائماً
      throw err;
    }
  }
}
