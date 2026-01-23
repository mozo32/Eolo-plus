import React from "react";

export type Column<T> = {
    key: keyof T | string;
    header: string;
    render?: (row: T) => React.ReactNode;
    className?: string;
};

type DataTableProps<T> = {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    loading?: boolean;
    emptyMessage?: string;
    search?: string;
    onSearchChange?: (value: string) => void;
    meta?: {
        current_page: number;
        last_page: number;
    };
    onPageChange?: (page: number) => void;
};

export function DataTable<T>({
    data,
    columns,
    keyField,
    loading = false,
    emptyMessage = "No hay datos para mostrar",
    search,
    onSearchChange,
    meta,
    onPageChange,
}: DataTableProps<T>) {
    return (
        <div className="space-y-3">
            {onSearchChange && (
                <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 w-72 focus-within:ring-2 focus-within:ring-primary/40">
                    <svg
                        className="h-4 w-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
                        />
                    </svg>

                    <input
                        type="text"
                        placeholder="Buscar registros"
                        value={search ?? ""}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                    />

                    {search && (
                        <button
                            onClick={() => onSearchChange("")}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                    Cargando información...
                </div>
            ) : !data || data.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full border-collapse">
                        <thead className="bg-muted/50">
                            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                                {columns.map((col, index) => (
                                    <th
                                        key={index}
                                        className="px-4 py-3 text-left font-semibold"
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {data.map((row) => (
                                <tr
                                    key={String(row[keyField])}
                                    className="border-t transition hover:bg-muted/40"
                                >
                                    {columns.map((col, index) => (
                                        <td
                                            key={index}
                                            className={`px-4 py-3 text-sm ${col.className ?? ""}`}
                                        >
                                            {col.render
                                                ? col.render(row)
                                                : String(
                                                    (row as any)[col.key] ?? ""
                                                )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {meta && onPageChange && (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <button
                        disabled={meta.current_page === 1}
                        onClick={() => onPageChange(meta.current_page - 1)}
                        className="
                flex h-8 w-8 items-center justify-center
                rounded-full border
                transition
                hover:bg-muted
                disabled:opacity-40
            "
                    >
                        ‹
                    </button>

                    {Array.from({ length: meta.last_page }).map((_, i) => {
                        const page = i + 1;
                        const isActive = page === meta.current_page;

                        if (
                            page === 1 ||
                            page === meta.last_page ||
                            Math.abs(page - meta.current_page) <= 1
                        ) {
                            return (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={`
                            flex h-8 w-8 items-center justify-center
                            rounded-full text-xs
                            ${isActive
                                            ? "bg-primary text-white"
                                            : "border hover:bg-muted"}
                        `}
                                >
                                    {page}
                                </button>
                            );
                        }

                        if (
                            page === meta.current_page - 2 ||
                            page === meta.current_page + 2
                        ) {
                            return (
                                <span
                                    key={page}
                                    className="flex h-8 w-8 items-center justify-center text-muted-foreground"
                                >
                                    …
                                </span>
                            );
                        }

                        return null;
                    })}

                    <button
                        disabled={meta.current_page === meta.last_page}
                        onClick={() => onPageChange(meta.current_page + 1)}
                        className="
                            flex h-8 w-8 items-center justify-center
                            rounded-full border
                            transition
                            hover:bg-muted
                            disabled:opacity-40
                        "
                    >
                        ›
                    </button>
                </div>
            )}
        </div>
    );
}
