import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildReportCsv, canExportReport, logReportExport, type ReportFilters, type ReportKind } from "@/lib/reports";

const reportTypes = new Set<ReportKind>(["inventory", "sales", "retailers", "purchasing", "valuation", "expiry", "traceability"]);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Authentication required.", { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ReportKind | null;
  if (!type || !reportTypes.has(type)) return new NextResponse("Unknown report type.", { status: 400 });
  if (!canExportReport(user, type)) return new NextResponse("Your role cannot export this report.", { status: 403 });

  const filters: ReportFilters = {
    q: url.searchParams.get("q") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    productId: url.searchParams.get("productId") ?? undefined,
    skuId: url.searchParams.get("skuId") ?? undefined,
    batchId: url.searchParams.get("batchId") ?? undefined,
    locationId: url.searchParams.get("locationId") ?? undefined,
    retailerId: url.searchParams.get("retailerId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    supplierId: url.searchParams.get("supplierId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    channel: url.searchParams.get("channel") ?? undefined,
    movementType: url.searchParams.get("movementType") ?? undefined,
    condition: url.searchParams.get("condition") ?? undefined,
    windowDays: url.searchParams.get("windowDays") ?? undefined,
  };

  const csv = await buildReportCsv(user, type, filters);
  await logReportExport(type, filters).catch((error) => {
    console.warn("[goodlivin:reports] Export audit log was not written", error);
  });

  return new NextResponse(csv.content, {
    status: csv.error ? 206 : 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csv.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
