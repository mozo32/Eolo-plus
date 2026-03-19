import React from 'react';
import { Plane, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Column<T> {
    header: string;
    render: (item: T) => React.ReactNode;
    className?: string;
    align?: 'left' | 'center' | 'right';
}

interface UniversalTableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    pagination?: {
        current_page: number;
        last_page: number;
        total: number;
    };
    onPageChange?: (page: number) => void;
    emptyMessage?: string;
    loadingMessage?: string;
}

const UniversalTable = <T extends { id: number | string }>({
    columns,
    data,
    loading,
    pagination,
    onPageChange,
    emptyMessage = "Sin resultados",
    loadingMessage = "Cargando datos..."
}: UniversalTableProps<T>) => {

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest ${
                                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                                    } ${col.className || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="py-24 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                            <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={16} />
                                        </div>
                                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{loadingMessage}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length > 0 ? (
                            data.map((item) => (
                                <tr key={item.id} className="group hover:bg-slate-50/50 transition-all">
                                    {columns.map((col, idx) => (
                                        <td
                                            key={idx}
                                            className={`px-6 py-5 ${
                                                col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                                            }`}
                                        >
                                            {col.render(item)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="py-32 text-center">
                                    <div className="max-w-xs mx-auto flex flex-col items-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <Search size={24} className="text-slate-200" />
                                        </div>
                                        <p className="text-slate-900 font-bold mb-1 text-lg">{emptyMessage}</p>
                                        <p className="text-slate-400 text-sm">Prueba ajustando los filtros de búsqueda.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && (
                <div className="px-8 py-6 bg-slate-50/30 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mostrando</span>
                        <span className="px-3 py-1 bg-white ring-1 ring-slate-200 rounded-lg text-sm font-bold text-slate-900">{data.length}</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">de {pagination.total}</span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => onPageChange?.(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                            className="px-4 py-2 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-all font-bold text-xs flex items-center gap-2 text-slate-600 shadow-sm"
                        >
                            <ChevronLeft size={16} strokeWidth={3} /> Anterior
                        </button>
                        <button
                            onClick={() => onPageChange?.(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                            className="px-4 py-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all font-bold text-xs flex items-center gap-2 text-white shadow-lg shadow-indigo-100"
                        >
                            Siguiente <ChevronRight size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversalTable;
