import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  filterFn?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  onRowDoubleClick?: (row: T) => void;
  emptyText?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  filterFn,
  searchPlaceholder,
  toolbar,
  onRowDoubleClick,
  emptyText,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let out = rows;
    if (filterFn && query.trim()) out = out.filter((r) => filterFn(r, query.trim().toLowerCase()));
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          const cmp = typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "de");
          return sortAsc ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, sortKey, sortAsc, columns, filterFn]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div>
      <div className="toolbar">
        {filterFn && (
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 220 }}
          />
        )}
        {toolbar}
      </div>
      <div className="table-wrap" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortValue && toggleSort(c.key)}
                  style={{ width: c.width, cursor: c.sortValue ? "pointer" : "default" }}
                >
                  {c.label}
                  {sortKey === c.key ? (sortAsc ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  className={selected === key ? "selected" : ""}
                  onClick={() => setSelected(key)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                >
                  {columns.map((c) => (
                    <td key={c.key}>{c.render(row)}</td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  {emptyText ?? "Keine Einträge"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
