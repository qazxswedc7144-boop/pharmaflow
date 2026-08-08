const express = require("express");
express.application.listen = function(...args) {
  console.log("[TEST] express listen called with port:", args[0]);
  return {
    on: () => {},
    close: (cb) => cb && cb()
  };
};

try {
  console.log("[TEST] Requiring ./dist/server.cjs...");
  require("./dist/server.cjs");
  console.log("✅ [TEST] dist/server.cjs loaded cleanly!");
  process.exit(0);
} catch (e) {
  console.error("❌ [TEST] Exception loading dist/server.cjs:", e);
  process.exit(1);
}
