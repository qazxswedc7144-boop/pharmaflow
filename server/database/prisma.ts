import { PrismaClient } from "@prisma/client";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

export class OfflineDatabaseError extends Error {
  constructor(model: string, operation: string) {
    super(`Database unavailable. Cannot perform ${operation} on ${model}.`);
    this.name = 'OfflineDatabaseError';
  }
}

// Resilient wrapper with exponential backoff
async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[Prisma] Operation '${operationName}' failed (attempt ${i + 1}/${MAX_RETRIES}):`, error);
      if (i < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error(`[Prisma] Operation '${operationName}' failed after ${MAX_RETRIES} attempts.`);
  throw lastError;
}

// Helper to handle optional prisma operations
const throwNoDb = () => {
  throw new Error("PostgreSQL is not configured. Application is running in offline/local mode.");
};

let basePrisma: PrismaClient | null = null;
let isDatabaseDisabled = false;

function getPrismaClient(): PrismaClient {
  if (basePrisma) return basePrisma;

  const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, '');
  console.log("[Prisma] DATABASE_URL raw length:", process.env.DATABASE_URL?.length);
  console.log("[Prisma] DATABASE_URL parsed:", databaseUrl ? "Set" : "Not set or empty");
  
  const isValidUrl = databaseUrl && databaseUrl !== "undefined" && databaseUrl !== "null" && databaseUrl !== "" && databaseUrl.includes("://");
  if (!isValidUrl) {
    console.warn("[Prisma] DATABASE_URL is not set or empty. Running in offline/local mode.");
    isDatabaseDisabled = true;
    return new Proxy({} as any, {
      get: (_target, prop) => {
        if (prop === '$connect' || prop === '$disconnect') return async () => {};
        if (prop === '$transaction' || prop === '$queryRaw' || prop === '$executeRaw') return throwNoDb;
        
        return new Proxy({}, {
          get: (_modelTarget, modelProp) => {
            const operation = String(modelProp);
            
            // Read operations
            if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(operation)) {
              return async () => null;
            }
            if (['findMany', 'groupBy'].includes(operation)) {
              return async () => [];
            }
            if (operation === 'count') {
              return async () => 0;
            }
            
            // Write operations
            if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation)) {
              throw new OfflineDatabaseError(String(prop), operation);
            }
            
            return async () => null;
          }
        });
      }
    });
  }

  try {
    basePrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ["warn", "error"], // Focused logging
    });
    console.log("[Prisma] Client initialized successfully.");
    return basePrisma;
  } catch (error) {
    console.error("[Prisma] Failed to initialize PrismaClient:", error);
    throw error;
  }
}

// Resilient proxy wrapper
const rawDbUrl = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, '');
const hasDb = !!rawDbUrl && rawDbUrl !== "undefined" && rawDbUrl !== "null" && rawDbUrl !== "" && rawDbUrl.includes("://");

const prismaClient = hasDb ? new Proxy(getPrismaClient(), {
  get(target, prop, receiver) {
    // Standard behavior for essential properties
    if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') {
      return Reflect.get(target, prop, receiver);
    }

    const value = target[prop as keyof typeof target];

    // Handle top-level functions directly
    if (typeof value === 'function') {
      if (prop === '$transaction') {
        return (callback: any) => withRetry(() => (target as any).$transaction(callback), '$transaction');
      }
      return value.bind(target);
    }

    // Handle models (objects that don't start with '$')
    if (typeof value === 'object' && value !== null && !String(prop).startsWith('$')) {
      return new Proxy(value, {
        get(modelTarget, modelProp, modelReceiver) {
          const modelValue = Reflect.get(modelTarget, modelProp, modelReceiver);
          
          if (typeof modelValue === 'function') {
            return (...args: any[]) => withRetry(() => modelValue.apply(modelTarget, args), `${String(prop)}.${String(modelProp)}`);
          }
          
          return modelValue;
        }
      });
    }

    return value;
  }
}) : new Proxy({} as any, {
  get: (_target, prop) => {
    if (prop === '$connect' || prop === '$disconnect') return async () => {};
    if (prop === '$transaction' || prop === '$queryRaw' || prop === '$executeRaw') return throwNoDb;
    
    return new Proxy({}, {
      get: (_modelTarget, modelProp) => {
        const operation = String(modelProp);
        
        // Read operations
        if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(operation)) {
          return async () => null;
        }
        if (['findMany', 'groupBy'].includes(operation)) {
          return async () => [];
        }
        if (operation === 'count') {
          return async () => 0;
        }
        
        // Write operations
        if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation)) {
          throw new OfflineDatabaseError(String(prop), operation);
        }
        
        return async () => null;
      }
    });
  }
});

export const prisma = prismaClient as any;
prisma.disable = () => {
  isDatabaseDisabled = true;
  console.warn("[Prisma] Database client disabled due to persistent connection failures.");
};
prisma.isConnected = () => !isDatabaseDisabled;

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  if (basePrisma) {
    console.log("[Prisma] Disconnecting...");
    await basePrisma.$disconnect();
  }
});
