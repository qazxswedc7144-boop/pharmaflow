// src/types/common.types.ts
import { SyncableEntity as BaseSyncableEntity, SyncStatus as DomainSyncStatus, PaymentStatus as DomainPaymentStatus } from "../domain";

export type SyncStatus = DomainSyncStatus;
export type PaymentStatus = DomainPaymentStatus;
export type SystemStatus = 'ACTIVE' | 'RECOVERY_MODE' | 'MAINTENANCE';

export type SyncableEntity = BaseSyncableEntity;

export type SubscriptionPlan = 'Free' | 'Basic' | 'Pro';
export type TenantStatus = 'Active' | 'Suspended' | 'Expired';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AccountingError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingError';
  }
}

export class InventoryError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export class SecurityError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
