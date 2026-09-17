/**
 * PharmaFlow ERP — Client-Side Audit Mirror
 *
 * ⚠️ ARCHITECTURAL WARNING:
 *   هذا الملف لا يكتب Audit Log. هو فقط:
 *     - يرسل أحداثاً للخادم عبر API (POST /api/audit).
 *     - يقرأ سجلات للعرض في UI (GET /api/audit).
 *
 * ❌ ممنوع: الكتابة في IndexedDB كـ "audit".
 *    IndexedDB قابل للتعديل من DevTools — غير موثوق مالياً.
 *
 * المصدر الوحيد للحقيقة: server/modules/audit/AuditService.ts
 */

import type { AuditAction } from '../../../server/modules/audit/AuditService';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ClientAuditEvent {
  action: AuditAction;
  entityType: string;
  entityId: string;
  reason?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  correlationId?: string;
}

export interface ServerAuditRecord {
  id: string;
  seq: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  beforeState: unknown;
  afterState: unknown;
  correlationId: string | null;
  hash: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────
// HTTP Client
// ─────────────────────────────────────────────────────────────────

interface AuditApiConfig {
  baseUrl: string;
  getAuthToken: () => string | null;
  getTenantId: () => string;
}

let apiConfig: AuditApiConfig = {
  baseUrl: '/api',
  getAuthToken: () => null,
  getTenantId: () => 'default',
};

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export class AuditLogService {
  /**
   * يُضبط مرة واحدة عند bootstrap التطبيق.
   */
  public static configure(config: AuditApiConfig): void {
    apiConfig = config;
  }

  /**
   * يُرسل حدثاً للخادم. الخادم هو من يولّد id/seq/hash.
   *
   * ⚠️ فشل هذا الاستدعاء لا يجب أن يوقف العملية المالية — لكنه
   *    يجب أن يُسجَّل بصوت عالٍ (console.error) ليكتشفه فريق العمليات.
   */
  async log(event: ClientAuditEvent): Promise<void> {
    try {
      const token = apiConfig.getAuthToken();
      const response = await fetch(`${apiConfig.baseUrl}/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        // ⚠️ لا نبتلع الخطأ — نسجله بوضوح
        console.error(
          `[AuditLog] Server rejected audit event: ${response.status} ${response.statusText}`,
          event,
        );
      }
    } catch (err) {
      console.error(
        '[AuditLog] Failed to send audit event to server:',
        err instanceof Error ? err.message : String(err),
        event,
      );
    }
  }

  /**
   * يُسجّل ترحيل فاتورة (اختصار).
   */
  async logSale(
    sale: { id: string; invoiceNumber?: string; finalTotal?: number },
    message?: string,
  ): Promise<void> {
    await this.log({
      action: 'INVOICE_POSTED',
      entityType: 'Sale',
      entityId: sale.id,
      reason: message ?? `Sale posted: ${sale.invoiceNumber ?? sale.id}`,
      afterState: {
        invoiceNumber: sale.invoiceNumber,
        finalTotal: sale.finalTotal,
      },
    });
  }

  /**
   * يقرأ آخر السجلات من الخادم — للعرض في UI فقط.
   *
   * ⚠️ ما تقرأه هنا قد يكون معدّلاً في الشبكة. للمراجعة الرسمية،
   *    استخدم audit logs من الخادم مباشرة (أو tools مثل psql).
   */
  async getRecentLogs(limit = 50): Promise<ServerAuditRecord[]> {
    try {
      const token = apiConfig.getAuthToken();
      const url = `${apiConfig.baseUrl}/audit?limit=${limit}`;
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        console.error(`[AuditLog] Failed to fetch: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { items: ServerAuditRecord[] };
      return data.items ?? [];
    } catch (err) {
      console.error(
        '[AuditLog] Failed to fetch audit logs:',
        err instanceof Error ? err.message : String(err),
      );
      return [];
    }
  }

  /**
   * يستعلم سجلات كيان معيّن (مثلاً: فاتورة محددة).
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
  ): Promise<ServerAuditRecord[]> {
    try {
      const token = apiConfig.getAuthToken();
      const url =
        `${apiConfig.baseUrl}/audit/entity/` +
        `${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) return [];
      const data = (await response.json()) as { items: ServerAuditRecord[] };
      return data.items ?? [];
    } catch (err) {
      console.error('[AuditLog] Failed to fetch entity history:', err);
      return [];
    }
  }
}

export const auditLogService = new AuditLogService();
