
import { db } from '@/core/db';
import { Sale, Purchase, UnifiedInvoice } from '@/types';
import { unifiedInventoryMutationEngine } from './UnifiedInventoryMutationEngine';
import { WorkerClient } from '@features/workers/worker.client';

/**
 * @deprecated Use UnifiedInventoryMutationEngine for all inventory and FIFO mutations.
 * This class is maintained for legacy compatibility ONLY.
 */
export class FIFOEngine {

  /**
   * ON PURCHASE: Create new layer
   * 🚨 REDIRECTED to UnifiedInventoryMutationEngine
   */
  static async addPurchaseLayer(item_id: string, _quantity: number, _unit_cost: number, reference_id: string): Promise<void> {
    console.warn(`[LEGACY BYPASS] FIFOEngine.addPurchaseLayer called for ${item_id}. Redirecting to canonical engine.`);
    
    await unifiedInventoryMutationEngine.executeMutation({
      productId: item_id,
      warehouseId: 'WH-MAIN',
      delta: Math.abs(_quantity),
      docType: 'PURCHASE',
      docId: reference_id,
      movementType: 'RECEIVE',
      userId: 'system-fifo-adapter',
      tenantId: 'TEN-DEV-001',
      branchId: 'BR-MAIN',
      transactionUuid: `FIFO-ADD-${reference_id}-${item_id}-${Date.now()}`,
      unitCost: _unit_cost
    });
  }

  /**
   * FIFO CONSUMPTION
   * 🚨 REDIRECTED to UnifiedInventoryMutationEngine
   */
  static async consumeFIFO(sale_id: string, item_id: string, quantity: number): Promise<{ totalCost: number, unitCost: number }> {
    console.warn(`[LEGACY BYPASS] FIFOEngine.consumeFIFO called for ${item_id}. Redirecting to canonical engine.`);
    
    await unifiedInventoryMutationEngine.executeMutation({
      productId: item_id,
      warehouseId: 'WH-MAIN',
      delta: -Math.abs(quantity),
      docType: 'SALE',
      docId: sale_id,
      movementType: 'DISPATCH',
      userId: 'system-fifo-adapter',
      tenantId: 'TEN-DEV-001',
      branchId: 'BR-MAIN',
      transactionUuid: `FIFO-CONS-${sale_id}-${item_id}-${Date.now()}`
    });

    return { totalCost: 0, unitCost: 0 }; 
  }

  /**
   * ON UNPOST: Restore consumed quantities
   * 🚨 REDIRECTED to UnifiedInventoryMutationEngine
   */
  static async reverseFIFO(sale_id: string): Promise<void> {
    console.warn(`[LEGACY BYPASS] FIFOEngine.reverseFIFO called for ${sale_id}. Redirecting to canonical engine.`);
    
    await unifiedInventoryMutationEngine.executeReversal({
      originalDocumentId: sale_id,
      originalDocumentType: 'SALE',
      reason: `Legacy FIFO reversal for #${sale_id}`,
      userId: 'system-fifo-adapter',
      tenantId: 'TEN-DEV-001',
      transactionUuid: `REVERSE-FIFO-${sale_id}-${Date.now()}`
    });
  }

  /**
   * ON PURCHASE UNPOST: Remove the layer
   * 🚨 REDIRECTED to UnifiedInventoryMutationEngine
   */
  static async removePurchaseLayer(reference_id: string): Promise<void> {
    console.warn(`[LEGACY BYPASS] FIFOEngine.removePurchaseLayer called for ${reference_id}. Redirecting to canonical engine.`);
    
    await unifiedInventoryMutationEngine.executeReversal({
      originalDocumentId: reference_id,
      originalDocumentType: 'PURCHASE',
      reason: `Legacy FIFO purchase removal for #${reference_id}`,
      userId: 'system-fifo-adapter',
      tenantId: 'TEN-DEV-001',
      transactionUuid: `REMOVE-LAYER-${reference_id}-${Date.now()}`
    });
  }

  /**
   * APPLY FIFO COSTING
   */
  static async apply(invoice: Sale | Purchase | UnifiedInvoice | { type?: string; customerId?: string; isReturn?: boolean; invoiceType?: string; items?: Array<{ product_id: string; qty: number; cost?: number; price: number }>; invoiceId?: string; id?: string }): Promise<{ totalCost: number, itemCosts: Record<string, number> }> {
    const invAny = invoice as Record<string, unknown>;
    const type = (invAny.type as string) || (invAny.customerId ? 'SALE' : 'PURCHASE');
    const isReturn = Boolean(invAny.isReturn) || invAny.invoiceType === 'مرتجع';
    const isConsumption = (type === 'SALE' && !isReturn) || (type === 'PURCHASE' && isReturn);

    if (isConsumption) {
      const items = (invAny.items as Array<any>) || [];
      const productIds = items.map(itm => itm.product_id || itm.productId || itm.id).filter(Boolean);
      
      const layers = productIds.length > 0
        ? await db.inventory_layers.where('item_id').anyOf(productIds).toArray()
        : [];

      const result = await WorkerClient.runFIFO(invoice, layers);

      if (result.updatedLayers.length > 0) {
        for (const layer of result.updatedLayers) {
          await db.inventory_layers.update(layer.id, { 
            quantity_remaining: layer.quantity_remaining, 
            lastModified: new Date().toISOString() 
          });
        }
      }
      
      if (result.consumptionLogs.length > 0) {
        await db.fifo_consumption_log.bulkAdd(result.consumptionLogs);
      }

      return {
        totalCost: result.totalCost,
        itemCosts: result.itemCosts
      };
    } else {
      let totalCost = 0;
      const itemCosts: Record<string, number> = {};
      const items = (invAny.items as Array<{ product_id: string; qty: number; cost?: number; price: number }>) || [];
      const invoiceId = (invAny.invoiceId as string) || (invAny.id as string) || '';

      for (const item of items) {
        const returnCost = type === 'SALE' ? (item.cost || item.price) : item.price;
        await this.addPurchaseLayer(item.product_id, item.qty, returnCost, invoiceId);
        itemCosts[item.product_id] = item.qty * returnCost;
        totalCost += itemCosts[item.product_id] ?? 0;
      }

      return { totalCost, itemCosts };
    }
  }
}
