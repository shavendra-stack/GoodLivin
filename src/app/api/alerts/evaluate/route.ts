import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AlertAutomationRunRow = {
  id: string;
  status: string;
  records_checked: number | null;
  alerts_created: number | null;
  alerts_updated: number | null;
  alerts_resolved: number | null;
  errors: unknown[] | null;
};

function safeCompare(provided: string | null, expected: string) {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const legacySecret = process.env.STAGE8_ALERT_JOB_SECRET;

  if (cronSecret && safeCompare(request.headers.get("authorization"), `Bearer ${cronSecret}`)) {
    return true;
  }

  if (legacySecret && safeCompare(request.headers.get("x-goodlivin-alert-secret"), legacySecret)) {
    return true;
  }

  return false;
}

function hasConfiguredSecret() {
  return Boolean(process.env.CRON_SECRET || process.env.STAGE8_ALERT_JOB_SECRET);
}

function summarizeRunErrors(errors: unknown) {
  if (!Array.isArray(errors) || errors.length === 0) return "The alert check was recorded as failed.";
  const messages = errors
    .map((error) => {
      if (typeof error === "string") return error;
      if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
      return "";
    })
    .map((message) => message.trim())
    .filter(Boolean);

  return messages.length > 0 ? messages.join(" ") : "The alert check was recorded as failed.";
}

async function runAlertEvaluation() {
  if (!hasConfiguredSecret()) {
    return NextResponse.json({ error: "Scheduled alert checks are not configured." }, { status: 503 });
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("stage8_run_operational_alert_check", { p_source: "scheduled" });
  if (error) {
    console.error("[goodlivin:alerts] scheduled evaluation failed", { message: error.message, code: error.code, details: error.details });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof data !== "string") {
    return NextResponse.json({ runId: data });
  }

  const { data: run, error: runReadError } = await supabase
    .from("alert_automation_runs")
    .select("id, status, records_checked, alerts_created, alerts_updated, alerts_resolved, errors")
    .eq("id", data)
    .maybeSingle<AlertAutomationRunRow>();

  if (runReadError) {
    console.error("[goodlivin:alerts] scheduled evaluation result could not be read", { message: runReadError.message, code: runReadError.code });
    return NextResponse.json({ error: "Alert check completed, but the automation result could not be read.", runId: data }, { status: 500 });
  }

  if (run?.status === "failed") {
    const message = summarizeRunErrors(run.errors);
    console.error("[goodlivin:alerts] scheduled evaluation recorded a failed run", { runId: data, message });
    return NextResponse.json({ error: message, runId: data, status: run.status }, { status: 500 });
  }

  return NextResponse.json({
    runId: data,
    status: run?.status ?? "unknown",
    recordsChecked: run?.records_checked ?? 0,
    alertsCreated: run?.alerts_created ?? 0,
    alertsUpdated: run?.alerts_updated ?? 0,
    alertsResolved: run?.alerts_resolved ?? 0,
  });
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function authorizationError(request: Request) {
  if (!hasConfiguredSecret()) {
    return NextResponse.json({ error: "Scheduled alert checks are not configured." }, { status: 503 });
  }

  if (!isAuthorized(request)) return unauthorizedResponse();
  return null;
}

export async function GET(request: Request) {
  const errorResponse = authorizationError(request);
  if (errorResponse) return errorResponse;
  return runAlertEvaluation();
}

export async function POST(request: Request) {
  const errorResponse = authorizationError(request);
  if (errorResponse) return errorResponse;
  return runAlertEvaluation();
}
