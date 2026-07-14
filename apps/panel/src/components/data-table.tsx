'use client';

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui';
import { tr } from '@/lib/tr';

/**
 * TanStack Table v8 — SUNUCU sayfalamasi (§2). Veri sunucudan sayfali gelir;
 * tabloda istemci tarafi sayfalama/siralama YAPILMAZ (100 bin satirlik cari defterinde patlar).
 */
export function DataTable<T>({
  columns,
  data,
  page,
  limit,
  total,
  onPageChange,
  isLoading,
  onRowClick,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const lastPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  {tr.common.loading}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  {tr.common.empty}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`border-b border-slate-100 last:border-0 ${
                    onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>
          {tr.common.total}: {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {tr.common.prev}
          </Button>
          <span>
            {tr.common.page} {page} / {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            {tr.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
