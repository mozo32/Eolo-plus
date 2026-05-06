import { useState, useMemo, useEffect, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import EntregaTurnoForm from './components/entregaTurno/EntregaTurnoForm';
import { fetchEntregarTurno, EntregarTurnoRow } from '@/stores/apiEntregarTurno';
import Swal from "sweetalert2";
import EntregaTurnoPdfExporterReactPdf from './components/entregaTurno/itemTables/EntregaTurnoPdfExporterReactPdf';
import EntregarTurnoDetalle from './components/entregaTurno/itemTables/EntregarTurnoDetalle';
import EntregarTurnoEditar from './components/entregaTurno/itemTables/EntregarTurnoEditar';
import { Filter, Plus, Search, Eye, Edit2, X, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

// Tipos (se mantienen igual)
type LaravelLink = { url: string | null; label: string; active: boolean; };
type LaravelMeta = { current_page: number; last_page: number; per_page?: number; total?: number; };
type Paginated<T> = { data: T[]; links?: LaravelLink[]; meta?: LaravelMeta; };
type Role = { slug: string; nombre: string; };
export type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };
type PageProps = { auth: { user: AuthUser | null; }; };

function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export default function EntregaTurno() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const debouncedQ = useDebounce(q, 350);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<LaravelMeta | undefined>(undefined);
    const [rows, setRows] = useState<EntregarTurnoRow[]>([]);
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [editarId, setEditarId] = useState<number | null>(null);
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [detalleOpen, setDetalleOpen] = useState(false);

    const [filters, setFilters] = useState({
        texto: "",
        fecha_inicio: "",
        fecha_fin: "",
    });

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        const roleLabels: Record<string, string> = { admin: "ADMIN", empleado: "EMPLEADO", fbo: "FBO" };
        const roleName = user?.roles.map((r) => roleLabels[r.slug] ?? r.nombre).join(", ") || "";
        return [{ title: `GESTIÓN DE TURNOS ${roleName ? '· ' + roleName : ''}` }];
    }, [user]);

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const load = async (opts?: { q?: string; page?: number }) => {
        const nextQ = opts?.q ?? debouncedQ;
        const nextPage = opts?.page ?? page;
        setLoading(true);
        try {
            const res = await fetchEntregarTurno({ q: nextQ, page: nextPage, ...filters });
            if (res && 'data' in res) {
                setRows(res.data ?? []);
                setMeta(res.meta);
            } else {
                setRows(res as EntregarTurnoRow[]);
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load({ q: debouncedQ, page }); }, [debouncedQ, page]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Turnos" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen relative">
                <div className="space-y-4 animate-in fade-in duration-500">

                    {/* Header Card */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gestión de Turnos</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historial y Registro de Operaciones</p>
                        </div>

                        <div className="flex gap-2 items-center">
                            <div className="relative hidden lg:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="BUSCAR REGISTRO..."
                                    className="h-9 w-64 rounded border border-slate-200 bg-slate-50 pl-9 pr-3 text-[10px] font-bold uppercase outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>

                            <button
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${filtersOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>FILTRAR</span>
                            </button>

                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center gap-2"
                            >
                                <Plus size={14} />
                                NUEVO REGISTRO
                            </button>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Fecha de Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Nombre del Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Responsable Entrega</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Jefe de Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos...</td></tr>
                                    ) : rows.length > 0 ? (
                                        rows.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">#{row.id}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                                                            {row.fecha ? new Date(String(row.fecha)).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Registro del sistema</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-[11px] font-bold text-slate-600 uppercase italic">
                                                    {row.nombre}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded uppercase tracking-tighter">
                                                        {row.nombre_quien_entrega ?? "S/N"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                        {row.nombre_jefe_turno_despacho ?? "-"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => { setDetalleId(row.id); setDetalleOpen(true); }}
                                                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                                                            title="Ver Detalle"
                                                        >
                                                            <Eye size={16} />
                                                        </button>

                                                        {user?.isAdmin && (
                                                            <button
                                                                onClick={() => setEditarId(row.id)}
                                                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => setPdfId(row.id)}
                                                            className="p-2 text-amber-500 hover:bg-amber-50 rounded transition-colors flex items-center gap-1 font-black text-[9px]"
                                                        >
                                                            <FileText size={16} /> PDF
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin registros encontrados</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                            <div className="flex gap-1">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
                                >
                                    <ChevronLeft size={14} /> ANTERIOR
                                </button>
                                <button
                                    disabled={page === meta.last_page}
                                    onClick={() => setPage(page + 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
                                >
                                    SIGUIENTE <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals con el nuevo estilo (Fondo oscuro blur, bordes redondeados grandes) */}
            {(isModalOpen || detalleOpen || editarId || filtersOpen) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {isModalOpen ? 'Registrar Entrega de Turno' :
                                     detalleOpen ? 'Detalle de Turno' :
                                     editarId ? 'Editar Información' : 'Filtros Avanzados'}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Módulo de Operaciones Diarias</p>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setDetalleOpen(false); setEditarId(null); setFiltersOpen(false); }}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {isModalOpen && <EntregaTurnoForm onClose={() => setIsModalOpen(false)} onSaved={() => { setIsModalOpen(false); setPage(1); load({ page: 1 }); }} />}

                            {detalleOpen && detalleId &&
                                <EntregarTurnoDetalle
                                    id={detalleId}
                                    onClose={() => {
                                        setDetalleOpen(false);
                                        setDetalleId(null);
                                    }}
                                    onSaved={() => {
                                        setIsModalOpen(false);
                                        setPage(1);
                                        load({ page: 1 });
                                    }}
                                />

                            }

                            {editarId && <EntregarTurnoEditar id={editarId} onClose={() => setEditarId(null)} onSaved={() => { setEditarId(null); setPage(1); load({ page: 1 }); }} />}

                            {filtersOpen && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Texto de búsqueda</label>
                                            <input type="text" value={filters.texto} onChange={(e) => setFilters({...filters, texto: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm uppercase font-bold" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase">Desde</label>
                                                <input type="date" value={filters.fecha_inicio} onChange={(e) => setFilters({...filters, fecha_inicio: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase">Hasta</label>
                                                <input type="date" value={filters.fecha_fin} onChange={(e) => setFilters({...filters, fecha_fin: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setPage(1); load({ page: 1 }); setFiltersOpen(false); }}
                                        className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700"
                                    >
                                        Aplicar Filtros
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <EntregaTurnoPdfExporterReactPdf id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
