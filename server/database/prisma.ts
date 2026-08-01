import { PrismaClient } from "@prisma/client";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const COOLDOWN_PERIOD_MS = 10000; // 10 seconds fallback cooldown on total connection loss

export class OfflineDatabaseError extends Error {
  constructor(model: string, operation: string) {
    super(`Database unavailable. Cannot perform ${operation} on ${model}.`);
    this.name = 'OfflineDatabaseError';
  }
}

let basePrisma: PrismaClient | null = null;
let isDatabaseDisabled = false;
let disabledUntil = 0;

function isConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.cause || err?.kind || err || "");
  const code = String(err?.code || "");
  const name = String(err?.name || "");

  return (
    code.startsWith("P") ||
    name.includes("Prisma") ||
    err instanceof OfflineDatabaseError ||
    msg.includes("Closed") ||
    msg.includes("closed") ||
    msg.includes("connection") ||
    msg.includes("Connection") ||
    msg.includes("EngineState") ||
    msg.includes("p1001") ||
    msg.includes("P1001") ||
    msg.includes("p1002") ||
    msg.includes("P1002") ||
    msg.includes("p1008") ||
    msg.includes("P1008") ||
    msg.includes("p1017") ||
    msg.includes("P1017") ||
    msg.includes("p2021") ||
    msg.includes("P2021") ||
    msg.includes("kind: Closed") ||
    msg.includes("Kind: Closed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("socket") ||
    msg.includes("terminated") ||
    msg.includes("Can't reach database") ||
    msg.includes("reach database") ||
    msg.includes("Closed, cause: None") ||
    msg.includes("does not exist") ||
    msg.includes("table")
  );
}

function getOfflineProxy(): PrismaClient {
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
            if (String(prop) === 'auditLog' || String(prop) === 'syncEvent') {
              return async () => ({ id: 'offline-' + Date.now(), createdAt: new Date() });
            }
            throw new OfflineDatabaseError(String(prop), operation);
          }
          
          return async () => null;
        }
      });
    }
  });
}

// Resilient wrapper with exponential backoff and auto-reconnection
async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: any;
  const parts = operationName.split('.');
  const modelName = parts[0] || '';
  const modelProp = parts[1] || parts[0] || '';

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errMsg = error?.message || String(error);
      
      // If PostgreSQL connection dropped, closed, or database table missing, don't keep retrying
      if (isConnectionError(error)) {
        if (basePrisma) {
          const clientToDisconnect = basePrisma;
          basePrisma = null;
          try {
            clientToDisconnect.$disconnect().catch(() => {});
          } catch {
            // ignore
          }
        }
        disabledUntil = Date.now() + COOLDOWN_PERIOD_MS;
        console.warn(`[Prisma] Connection/Database error detected on '${operationName}'. Activating fallback cooldown.`);
        break;
      }

      console.warn(`[Prisma] Operation '${operationName}' failed (attempt ${i + 1}/${MAX_RETRIES}):`, errMsg);

      if (i < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Provide fallback response for offline / database error state
  if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(modelProp)) {
    return null as unknown as T;
  }
  if (['findMany', 'groupBy'].includes(modelProp)) {
    return [] as unknown as T;
  }
  if (modelProp === 'count') {
    return 0 as unknown as T;
  }
  if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(modelProp)) {
    if (modelName === 'auditLog' || modelName === 'syncEvent') {
      return { id: 'offline-' + Date.now(), createdAt: new Date() } as unknown as T;
    }
    return { id: 'offline-' + Date.now() } as unknown as T;
  }
  
  return null as unknown as T;
}

// Helper to handle optional prisma operations
const throwNoDb = () => {
  throw new Error("PostgreSQL is not configured. Application is running in offline/local mode.");
};

function getPrismaClient(): PrismaClient {
  if (isDatabaseDisabled || (disabledUntil > 0 && Date.now() < disabledUntil)) {
    return getOfflineProxy();
  }

  if (basePrisma) return basePrisma;

  let databaseUrl = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, '');
  
  const isValidUrl = databaseUrl && databaseUrl !== "undefined" && databaseUrl !== "null" && databaseUrl !== "" && databaseUrl.includes("://");
  if (!isValidUrl) {
    console.warn("[Prisma] DATABASE_URL is not set or empty. Running in offline/local mode.");
    isDatabaseDisabled = true;
    return getOfflineProxy();
  }

  if (!databaseUrl.includes('connection_limit=')) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}connection_limit=5&pool_timeout=10`;
  }

  try {
    basePrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [],
    });
    console.log("[Prisma] Client initialized successfully.");
    return basePrisma;
  } catch (error) {
    console.error("[Prisma] Failed to initialize PrismaClient:", error);
    disabledUntil = Date.now() + COOLDOWN_PERIOD_MS;
    return getOfflineProxy();
  }
}

// Resilient dynamic proxy wrapper
const prismaClient = new Proxy({} as any, {
  get(_target, prop, receiver) {
    const currentClient = getPrismaClient();

    // Standard behavior for essential properties
    if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') {
      return Reflect.get(currentClient, prop, receiver);
    }

    const value = (currentClient as any)[prop];

    // Handle top-level functions directly
    if (typeof value === 'function') {
      if (prop === '$transaction') {
        return (callback: any, options?: any) => withRetry(() => (getPrismaClient() as any).$transaction(callback, options), '$transaction');
      }
      return value.bind(currentClient);
    }

    // Handle models (objects that don't start with '$')
    if (typeof value === 'object' && value !== null && !String(prop).startsWith('$')) {
      return new Proxy(value, {
        get(_modelTarget, modelProp) {
          const freshModel = (getPrismaClient() as any)[prop];
          const modelValue = freshModel ? freshModel[modelProp] : undefined;
          
          if (typeof modelValue === 'function') {
            return (...args: any[]) => withRetry(() => {
              const latestModel = (getPrismaClient() as any)[prop];
              return latestModel[modelProp].apply(latestModel, args);
            }, `${String(prop)}.${String(modelProp)}`);
          }
          
          return modelValue;
        }
      });
    }

    return value;
  }
});

export const prisma = prismaClient as any;
prisma.disable = () => {
  isDatabaseDisabled = true;
  console.warn("[Prisma] Database client disabled due to persistent connection failures.");
};
prisma.enable = () => {
  isDatabaseDisabled = false;
  disabledUntil = 0;
  console.log("[Prisma] Database client re-enabled.");
};
prisma.isConnected = () => !isDatabaseDisabled && (disabledUntil === 0 || Date.now() >= disabledUntil);

// Graceful shutdown hooks
process.on("beforeExit", async () => {
  if (basePrisma) {
    console.log("[Prisma] Disconnecting...");
    try {
      await basePrisma.$disconnect();
    } catch {
      // ignore
    }
  }
});

