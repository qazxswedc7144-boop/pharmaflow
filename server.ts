@@
---
*** Begin Patch
*** Update File: server.ts
@@
-// Enforce strict environment validation immediately upon boot, and set safe defaults if missing
-if (!process.env.ENCRYPTION_KEY) {
-  console.warn("⚠️ Warning: ENCRYPTION_KEY is not defined in the environment. Falling back to a temporary system key to prevent boot failure.");
-  process.env.ENCRYPTION_KEY = 'pharmaflow-fallback-secure-master-key-gcm-sha256-2026';
-}
-
-if (!process.env.JWT_SECRET) {
-  console.warn("⚠️ Warning: JWT_SECRET is missing from the environment. Falling back to a temporary secret to prevent boot failure.");
-  process.env.JWT_SECRET = 'pharmaflow-local-development-jwt-secure-secret-2026';
-}
-
-if (!process.env.JWT_REFRESH_SECRET) {
-  console.warn("⚠️ Warning: JWT_REFRESH_SECRET is missing from the environment. Falling back to a temporary refresh secret to prevent boot failure.");
-  process.env.JWT_REFRESH_SECRET = 'pharmaflow-local-development-jwt-refresh-secure-secret-2026';
-}
+// Enforce strict environment validation immediately upon boot.
+// In production we fail-fast on missing critical secrets. In development we keep a fallback for DX.
+const missingSecrets = [] as string[];
+if (!process.env.ENCRYPTION_KEY) missingSecrets.push('ENCRYPTION_KEY');
+if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET');
+if (!process.env.JWT_REFRESH_SECRET) missingSecrets.push('JWT_REFRESH_SECRET');
+
+if (process.env.NODE_ENV === 'production' && missingSecrets.length > 0) {
+  console.error(`❌ Critical environment variables missing for production: ${missingSecrets.join(', ')}. Aborting startup.`);
+  // Fail fast in production to avoid insecure defaults leaking into production deployments
+  process.exit(1);
+} else {
+  if (missingSecrets.length > 0) {
+    console.warn(`⚠️ Development fallback: missing ${missingSecrets.join(', ')}. Using temporary dev-safe defaults.`);
+  }
+  // Non-production safe defaults (development only)
+  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pharmaflow-fallback-secure-master-key-gcm-sha256-2026';
+  process.env.JWT_SECRET = process.env.JWT_SECRET || 'pharmaflow-local-development-jwt-secure-secret-2026';
+  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pharmaflow-local-development-jwt-refresh-secure-secret-2026';
+}
@@
-  if (hasDb) {
-    setTimeout(() => {
-      console.log("[BOOT] Applying Prisma database migrations asynchronously in background...");
-      exec("npx prisma migrate deploy", { timeout: 15000 }, (migrateErr, stdout) => {
-        if (migrateErr) {
-          console.log("[BOOT] Database migrations info: Cloud SQL / Postgres offline or unreachable. Proceeding with offline fallback engine.");
-        } else {
-          if (stdout) console.log("[BOOT] Prisma migrate stdout:", stdout.trim());
-          console.log("[BOOT] Prisma database migrations applied successfully.");
-        }
-      });
-    }, 100);
-  }
+  if (hasDb) {
+    setTimeout(() => {
+      console.log("[BOOT] Applying Prisma database migrations asynchronously in background...");
+      // Increase timeout to allow longer running migrations; log explicitly on failure
+      try {
+        exec("npx prisma migrate deploy", { timeout: 120000 }, (migrateErr, stdout, stderr) => {
+          if (migrateErr) {
+            console.warn("[BOOT] Prisma migrate failed or timed out. Cloud SQL / Postgres may be offline or unreachable. Proceeding with offline fallback engine.", migrateErr?.message || stderr || '');
+          } else {
+            if (stdout) console.log("[BOOT] Prisma migrate stdout:", stdout.trim());
+            console.log("[BOOT] Prisma database migrations applied successfully.");
+          }
+        });
+      } catch (e) {
+        console.warn("[BOOT] Failed to start Prisma migrate process:", (e as Error).message || e);
+      }
+    }, 100);
+  }
*** End Patch
