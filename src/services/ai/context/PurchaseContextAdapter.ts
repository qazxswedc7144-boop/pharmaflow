/**
 * PharmaFlow AI Domain Context Adapter - Purchases
 * Assembles procurement and supplier status context via purchasesService.
 * STRICT RULE: No direct database (Dexie/Prisma) queries inside AI adapters.
 */

import { purchasesService } from '@/features/purchases/services/purchasesService';
import { AIUserContext, PurchaseContextData } from '../types';

export class PurchaseContextAdapter {
  private cache: { data: PurchaseContextData; timestamp: number } | null = null;
  private CACHE_TTL_MS = 20000; // 20 seconds short-lived cache

  /**
   * Retrieves purchase and supplier context with role control and caching.
   */
  public async getContext(userContext: AIUserContext): Promise<PurchaseContextData> {
    // Role-Based Access Control
    const allowedRoles = ['admin', 'manager', 'accountant', 'pharmacist'];
    if (!allowedRoles.includes(userContext.userRole)) {
      return {
        pendingOrdersCount: 0,
        activeSuppliersCount: 0,
        recentOrders: [],
      };
    }

    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const purchasesRaw = await purchasesService.getPurchases().catch(() => []);
      const purchasesList = Array.isArray(purchasesRaw) ? purchasesRaw : [];

      let pendingOrdersCount = 0;
      const supplierSet = new Set<string>();

      const recentOrders = purchasesList
        .slice(0, 10)
        .map((p: any) => {
          const supplierName = String(p.supplierName || p.supplierId || 'مورد غير محدد');
          if (p.supplierId || p.supplierName) {
            supplierSet.add(supplierName);
          }

          const status = String(p.status || p.invoiceStatus || 'PENDING').toUpperCase();
          if (status === 'PENDING' || status === 'UNPAID') {
            pendingOrdersCount++;
          }

          return {
            supplierName,
            status,
            totalAmount: Number(p.totalAmount || p.finalTotal || 0),
            date: String(p.createdAt || p.date || new Date().toISOString().split('T')[0]),
          };
        });

      const result: PurchaseContextData = {
        pendingOrdersCount,
        activeSuppliersCount: supplierSet.size,
        recentOrders,
      };

      this.cache = { data: result, timestamp: now };
      return result;
    } catch (error) {
      console.error('❌ [PurchaseContextAdapter] Error assembling context:', error);
      return {
        pendingOrdersCount: 0,
        activeSuppliersCount: 0,
        recentOrders: [],
      };
    }
  }

  /**
   * Helper to estimate token usage for purchase context
   */
  public estimateTokens(data: PurchaseContextData): number {
    const jsonStr = JSON.stringify(data);
    return Math.ceil(jsonStr.length / 4);
  }
}

export const purchaseContextAdapter = new PurchaseContextAdapter();
