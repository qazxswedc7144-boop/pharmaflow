import { create } from 'zustand';
import { Product, Category } from '@/types';
import { InventoryService } from '@features/inventory/services/InventoryService';
import { db } from '@/core/db';

interface InventoryState {
  products: Product[];
  categories: Category[];
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  loadInventory: () => Promise<void>;
  updateStockDirectly: (productId: string, delta: number) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  categories: [],
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  loadInventory: async () => {
    const [products, categories] = await Promise.all([
      InventoryService.getProducts(),
      db.db.categories.toArray(),
    ]);
    set({ products, categories: categories as any[] });
  },
  updateStockDirectly: async (productId: string, delta: number) => {
    await InventoryService.updateStock(productId, delta);
    await get().loadInventory();
  },
  addCategory: async (category: Category) => {
    await db.db.categories.put(category);
    await get().loadInventory();
  },
}));
