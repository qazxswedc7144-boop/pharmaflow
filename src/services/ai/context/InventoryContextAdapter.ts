/**
 * PharmaFlow AI Domain Context Adapter - Inventory
 * Retrieves sanitized, role-filtered inventory metrics via InventoryService & AccountingReportsService.
 * STRICT RULE: No direct database (Dexie/Prisma) queries inside AI adapters.
 */

import { InventoryService } from '@/features/inventory/services/InventoryService';
import { AccountingReportsService } from '@/features/accounting/services/AccountingReportsService';
import { AIUserContext, InventoryContextData } from '../types';

export class InventoryContextAdapter {
  private cache: { data: InventoryContextData; timestamp: number } | null = null;
  private CACHE_TTL_MS = 20000; // 20 seconds short-lived cache

  /**
   * Retrieves inventory context with role authorization, sanitization, and caching.
   */
  public async getContext(userContext: AIUserContext): Promise<InventoryContextData> {
    // Role-Based Access Control
    const allowedRoles = ['admin', 'pharmacist', 'manager', 'accountant', 'staff'];
    if (!allowedRoles.includes(userContext.userRole)) {
      return {
        totalItemsCount: 0,
        lowStockItems: [],
        expiredItems: [],
        totalInventoryValue: 0,
      };
    }

    // Return cached response if valid
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      // Parallel execution via Business Services
      const [products, lowStockRaw, expiringRaw, valuationRaw] = await Promise.all([
        InventoryService.getProducts().catch(() => []),
        AccountingReportsService.getLowStockItems().catch(() => []),
        AccountingReportsService.getExpiringSoonItems().catch(() => []),
        AccountingReportsService.getInventoryValuation().catch(() => 0),
      ]);

      const activeProducts = products.filter((p) => !p.deletedAt);
      const totalItemsCount = activeProducts.length;

      // Sanitize low stock items (top 10)
      const lowStockItems = (lowStockRaw || []).slice(0, 10).map((item: any) => ({
        id: item.id || item.productId || 'unknown',
        name: String(item.name || item.itemName || 'صنف غير محدد'),
        quantity: Number(item.currentQuantity ?? item.quantity ?? 0),
        reorderLevel: Number(item.minQuantity ?? item.reorderLevel ?? 10),
      }));

      // Sanitize expired/expiring items (top 10)
      const expiredItems = (expiringRaw || []).slice(0, 10).map((item: any) => ({
        id: item.id || item.productId || 'unknown',
        name: String(item.name || item.itemName || item.TradeName || 'صنف غير محدد'),
        expiryDate: String(item.ExpiryDate || item.expiryDate || 'N/A'),
        quantity: Number(item.quantity ?? item.currentQuantity ?? 0),
      }));

      const totalInventoryValue = typeof valuationRaw === 'number' ? valuationRaw : 0;

      const result: InventoryContextData = {
        totalItemsCount,
        lowStockItems,
        expiredItems,
        totalInventoryValue,
      };

      this.cache = { data: result, timestamp: now };
      return result;
    } catch (error) {
      console.error('❌ [InventoryContextAdapter] Error assembling context:', error);
      return {
        totalItemsCount: 0,
        lowStockItems: [],
        expiredItems: [],
        totalInventoryValue: 0,
      };
    }
  }

  /**
   * Helper to estimate token usage for inventory context (approx 4 chars per token)
   */
  public estimateTokens(data: InventoryContextData): number {
    const jsonStr = JSON.stringify(data);
    return Math.ceil(jsonStr.length / 4);
  }
}

export const inventoryContextAdapter = new InventoryContextAdapter();
