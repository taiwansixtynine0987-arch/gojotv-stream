import type { StreamJob, Env } from "./types/queue";
import { createSupabaseClient } from "./services/supabase";
import { processStreamJob } from "./handlers/stream-job";

export default {
  async queue(
    batch: MessageBatch<StreamJob>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const supabase = createSupabaseClient(env);

    for (const message of batch.messages) {
      const job = message.body;

      console.log(
        `[W3] Processing anime_id=${job.anime_id} episodes=${job.episodes?.length ?? 0}`
      );

      try {
        const result = await processStreamJob(job, supabase, env);

        console.log(
          `[W3] Done: inserted=${result.inserted} failed=${result.failed} remaining=${result.remaining} skipped=${result.skipped}`
        );

        // Always ack — even partial success counts.
        // Remaining episodes were re-queued inside processStreamJob.
        message.ack();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[W3] Error for anime_id=${job.anime_id}: ${msg}`);

        // Retry up to max_retries (set in wrangler.toml = 3)
        message.retry();
      }
    }
  },

  // Optional: HTTP endpoint for manual testing
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, worker: "gojotv-stream" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Manual trigger: POST /run with StreamJob in body
    if (url.pathname === "/run" && request.method === "POST") {
      try {
        const job = (await request.json()) as StreamJob;
        const supabase = createSupabaseClient(env);
        const result = await processStreamJob(job, supabase, env);
        return new Response(JSON.stringify({ ok: true, result }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
