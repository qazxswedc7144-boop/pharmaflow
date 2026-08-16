*** Begin Patch
*** Update File: src/app/App.tsx
@@
-      // Clear DB to resolve IDBKeyRange error if requested (one-time fix)
-      if (!localStorage.getItem('pharmaflow_db_reset_v4')) {
-        try {
-          console.log("🧹 Clearing IndexedDB to resolve IDBKeyRange error...");
-          const databases = await window.indexedDB.databases();
-          for (const dbInfo of databases) {
-            if (dbInfo.name) {
-              console.log(`Deleting: ${dbInfo.name}`);
-              window.indexedDB.deleteDatabase(dbInfo.name);
-            }
-          }
-        } catch (e) {
-          window.indexedDB.deleteDatabase("pharmaflow");
-        }
-        localStorage.setItem('pharmaflow_db_reset_v4', 'true');
-      }
+      // Clear DB to resolve IDBKeyRange error (development-only, or when explicitly forced)
+      try {
+        const shouldReset = (!localStorage.getItem('pharmaflow_db_reset_v4') && process.env.NODE_ENV !== 'production') || localStorage.getItem('pharmaflow_force_db_reset') === 'true';
+        if (shouldReset) {
+          console.log("🧹 Clearing IndexedDB to resolve IDBKeyRange error (development only)...");
+          if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
+            const databases = await window.indexedDB.databases();
+            for (const dbInfo of databases) {
+              if (dbInfo.name) {
+                console.log(`Deleting: ${dbInfo.name}`);
+                try { window.indexedDB.deleteDatabase(dbInfo.name); } catch (err) { console.warn('Failed deleting DB', dbInfo.name, err); }
+              }
+            }
+          } else {
+            try { window.indexedDB.deleteDatabase('pharmaflow'); } catch (err) { console.warn('IndexedDB delete fallback failed', err); }
+          }
+          localStorage.setItem('pharmaflow_db_reset_v4', 'true');
+        }
+      } catch (e) {
+        console.warn('[DB_RESET] IndexedDB reset encountered an error:', e);
+      }
@@
-      window.addEventListener('hashchange', parseRoute);
-      return () => {
-        heartbeatService.stop();
-        backupService.stopAutoTimer();
-        if (syncEngine) {
-          try {
-            syncEngine.stop();
-          } catch (scErr) {
-            console.warn("Soft-catch syncEngine stop error:", scErr);
-          }
-        }
-        if (stopCurrencyObserver) stopCurrencyObserver();
-        window.removeEventListener('hashchange', parseRoute);
-        RealtimeReplicationService.disconnect();
-      };
+      // Prepare named handlers for focus/blur so they can be cleaned up correctly
+      const onWindowFocus = () => { checkLock().catch(e => console.error("[FocusLock] Failed:", e)); };
+      const onWindowBlur = async () => {
+        try {
+          const settings = await appLockService.getSettings();
+          if (settings?.is_enabled && settings.lock_mode === 'instant') {
+            setIsLocked(true);
+          }
+        } catch (e) {
+          console.error("[BlurLock] Failed:", e);
+        }
+      };
+
+      window.addEventListener('hashchange', parseRoute);
+      window.addEventListener('focus', onWindowFocus);
+      window.addEventListener('blur', onWindowBlur);
+
+      return () => {
+        heartbeatService.stop();
+        backupService.stopAutoTimer();
+        if (syncEngine) {
+          try {
+            syncEngine.stop();
+          } catch (scErr) {
+            console.warn("Soft-catch syncEngine stop error:", scErr);
+          }
+        }
+        if (stopCurrencyObserver) stopCurrencyObserver();
+        window.removeEventListener('hashchange', parseRoute);
+        window.removeEventListener('focus', onWindowFocus);
+        window.removeEventListener('blur', onWindowBlur);
+        RealtimeReplicationService.disconnect();
+      };
*** End Patch
