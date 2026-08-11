import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = "No records found." }: { columns: DataTableColumn<T>[]; rows: T[]; rowKey: (row: T) => string; emptyMessage?: string }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[1.35rem] border border-forest-100/80 bg-white shadow-soft">
      <div className="w-full min-w-0 max-w-full overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-forest-100/80 bg-slate-50/90 text-[11px] uppercase tracking-[0.14em] text-slate-500 backdrop-blur">
            <tr>{columns.map((column) => <th className={cn("px-5 py-3.5 font-semibold", column.className)} key={column.key}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td className="px-5 py-12 text-center text-slate-500" colSpan={columns.length}>{emptyMessage}</td></tr>
            ) : rows.map((row) => (
              <tr className="transition-colors hover:bg-forest-50/40" key={rowKey(row)}>
                {columns.map((column) => <td className={cn("px-5 py-4 align-middle text-ink", column.className)} key={column.key}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
