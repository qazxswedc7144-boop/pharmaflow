/**
 * PharmaFlow AI Copilot Foundation - Core Types & Interfaces
 * Strictly enforces clean architecture, safety rules, and context definitions.
 */

export type AIModelTarget = 
  | 'gemini-3.6-flash'       // Default for rapid summarization, Q&A, and basic analysis
  | 'gemini-3.1-pro-preview'; // Advanced reasoning, complex financial audits, drug cross-validation

export interface AICapabilityScope {
  module: 'inventory' | 'sales' | 'purchases' | 'accounting' | 'drugs' | 'analytics';
  action: 'read' | 'analyze' | 'recommend';
  requiredRole: 'admin' | 'pharmacist' | 'accountant' | 'manager';
}

export interface AIUserContext {
  userId: string;
  userRole: 'admin' | 'pharmacist' | 'accountant' | 'manager' | 'staff';
  branchId: string;
  tenantId: string;
}

export interface InventoryContextData {
  totalItemsCount: number;
  lowStockItems: Array<{ id: string; name: string; quantity: number; reorderLevel: number }>;
  expiredItems: Array<{ id: string; name: string; expiryDate: string; quantity: number }>;
  totalInventoryValue: number;
}

export interface SalesContextData {
  periodDays: number;
  totalSalesCount: number;
  totalRevenue: number;
  topSellingProducts: Array<{ name: string; quantity: number; revenue: number }>;
  averageOrderValue: number;
}

export interface PurchaseContextData {
  pendingOrdersCount: number;
  activeSuppliersCount: number;
  recentOrders: Array<{ supplierName: string; status: string; totalAmount: number; date: string }>;
}

export interface FinancialContextData {
  grossProfitMargin: number;
  netProfit: number;
  totalAccountsReceivable: number;
  totalAccountsPayable: number;
}

export interface DrugContextData {
  drugId?: string;
  tradeName?: string;
  activeIngredient?: string;
  dosageForm?: string;
  contraindications?: string[];
  interactions?: string[];
}

export interface ConsolidatedAIContext {
  user: AIUserContext;
  timestamp: string;
  inventory?: InventoryContextData;
  sales?: SalesContextData;
  purchases?: PurchaseContextData;
  financials?: FinancialContextData;
  drugInfo?: DrugContextData;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  userTemplate: string;
  requiredScopes: AICapabilityScope[];
  responseFormat: 'text' | 'json' | 'markdown';
}

export interface AIRequestOptions {
  model?: AIModelTarget;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  userContext: AIUserContext;
  promptId?: string;
  variables?: Record<string, unknown>;
  rawPrompt?: string;
  includeContexts?: Array<'inventory' | 'sales' | 'purchases' | 'financials' | 'drugInfo'>;
  taskComplexity?: 'simple' | 'medium' | 'complex';
  timeoutMs?: number;
}

export interface AIServerErrorResponse {
  success: false;
  errorCode: string;
  message: string;
}

export interface AISafetyCheckResult {
  isSafe: boolean;
  blockReason?: string;
  flaggedCategories: Array<'financial_risk' | 'medical_safety' | 'data_privacy' | 'hallucination_detected'>;
  sanitizedText?: string;
}

export interface AIResponse<T = unknown> {
  id: string;
  modelUsed: AIModelTarget;
  rawOutput: string;
  parsedData?: T;
  safetyCheck: AISafetyCheckResult;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
  timestamp: string;
}

export interface AIUsageLog {
  id: string;
  timestamp: string;
  userId: string;
  branchId: string;
  model: AIModelTarget;
  promptId?: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: 'success' | 'blocked' | 'error';
  errorMessage?: string;
}
