import { enqueueDueAdminReports } from '../../worker/reports/dispatcher.js';
import { dispatchPendingNotifications } from '../../worker/email/outbox.js';

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(run(env));
  },

  async fetch(_request, env) {
    const result = await run(env);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
      status: result.ok ? 200 : 500,
    });
  },
};

async function run(env) {
  if (!env.APP_DB || !env.NOTIFICATION_QUEUE) {
    return { ok: false, error: 'D1 APP_DB or notification queue is not configured.' };
  }
  const reports = await enqueueDueAdminReports(env);
  const notifications = await dispatchPendingNotifications(env);
  return { ok: true, reports, notifications };
}
