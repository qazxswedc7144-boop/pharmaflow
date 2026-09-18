/**
 * PharmaFlow ERP — Vercel Serverless Entry Point
 *
 * يستقبل كل الطلبات على /api/* ويمررها إلى Express app.
 * Vercel يكتشف هذا الملف تلقائياً ويجعله serverless function.
 *
 * ⚠️ ملاحظات:
 *   - Express app يُبنى مرة واحدة عند أول cold start (singleton).
 *   - كل الطلبات اللاحقة تعيد استخدام نفس الـ app.
 *   - لا يعمل فيه app.listen — Vercel يدير HTTP بنفسه.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../server/app';

// ─────────────────────────────────────────────────────────────────
// Singleton — يُبنى مرة واحدة عند أول cold start
// ─────────────────────────────────────────────────────────────────

let cachedApp: ReturnType<typeof buildApp> | null = null;

function getApp(): ReturnType<typeof buildApp> {
  if (!cachedApp) {
    console.log('[Vercel] Building Express app (cold start)...');
    try {
      cachedApp = buildApp({ logHttp: true });
      console.log('[Vercel] Express app ready.');
    } catch (err) {
      console.error('[Vercel] FATAL: Failed to build Express app:', err);
      throw err;
    }
  }
  return cachedApp;
}

// ─────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    const app = getApp();
    // Express app قابل للاستدعاء كـ (req, res) مباشرة
    return app(req as any, res as any);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Vercel] Unhandled handler error:', message);

    // لا نحاول استخدام res إذا كان قد أُرسل بالفعل
    if (!res.headersSent) {
      res.status(500).json({
        error: 'BOOTSTRAP_FAILED',
        message:
          process.env.NODE_ENV === 'production'
            ? 'The API failed to initialize. Please check server logs.'
            : message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Vercel Serverless Configuration
// ─────────────────────────────────────────────────────────────────

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 60, // ثواني (Vercel Pro). على Hobby: 10s.
  memory: 1024,    // MB
};
