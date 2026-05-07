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
import { Filter, Plus, Search, Eye, Edit2, X, ListCheck, ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';

type LaravelLink = { url: string | null; label: string; active: boolean; };
type LaravelMeta = { current_page: number; last_page: number; per_page?: number; total?: number; from?: number; to?: number; };
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
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);

    const [filtros, setFiltros] = useState({
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia',
        nombreQuienEntrega: '',
        nombreQuienRecibe: '',
        nombreJefeTurnoDespacho: ''
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    const [pdfId, setPdfId] = useState<number | null>(null);
    const [editarId, setEditarId] = useState<number | null>(null);
    const [validarId, setValidarId] = useState<number | null>(null);
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [detalleOpen, setDetalleOpen] = useState(false);

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        const roleLabels: Record<string, string> = { admin: "ADMIN", empleado: "EMPLEADO", fbo: "FBO" };
        const roleName = user?.roles.map((r) => roleLabels[r.slug] ?? r.nombre).join(", ") || "";
        return [{ title: `GESTIÓN DE TURNOS ${roleName ? '· ' + roleName : ''}` }];
    }, [user]);

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    useEffect(() => {
        if (mostrarModalFecha) {
            setFiltrosEdicion({ ...filtros });
        }
    }, [mostrarModalFecha, filtros]);

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
    };

    const limpiarFiltros = () => {
        setFiltros({
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia',
            nombreQuienEntrega: '',
            nombreQuienRecibe: '',
            nombreJefeTurnoDespacho: ''
        });
        setQ("");
    };

    useEffect(() => {
        setPage(1);
    }, [filtros, debouncedQ]);

    const load = async (opts?: { q?: string; page?: number }) => {
        const nextQ = opts?.q ?? debouncedQ;
        const nextPage = opts?.page ?? page;
        setLoading(true);
        try {
            const res = await fetchEntregarTurno({
                q: nextQ,
                page: nextPage,
                ...filtros
            });
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

    useEffect(() => { load({ q: debouncedQ, page }); }, [debouncedQ, page, filtros]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Turnos" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen relative">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gestión de Turnos</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historial y Registro de Operaciones</p>
                        </div>

                        <div className="flex gap-2 items-center">


                            <button
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${filtersOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>{filtersOpen ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
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
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha de Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Entrega Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Recibe Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Validado por Jefe de Area</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                    <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                        <td className="px-4 py-2 border-b border-slate-200 text-center">
                                            <button onClick={limpiarFiltros} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Limpiar Filtros">
                                                <X size={14} />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <button
                                                onClick={() => setMostrarModalFecha(true)}
                                                className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm"
                                            >
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Calendar size={12} className="text-blue-500 shrink-0" />
                                                    <span className="truncate font-bold text-slate-600 uppercase">
                                                        {filtros.periodo === 'dia' ? filtros.fechaInicio :
                                                            filtros.periodo === 'rango' ? `${filtros.fechaInicio} / ${filtros.fechaFin}` :
                                                                `${filtros.periodo}`}
                                                    </span>
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text" placeholder="Buscar entrega..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.nombreQuienEntrega}
                                                onChange={(e) => setFiltros({ ...filtros, nombreQuienEntrega: e.target.value.toUpperCase() })}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text" placeholder="Buscar recibe..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.nombreQuienRecibe}
                                                onChange={(e) => setFiltros({ ...filtros, nombreQuienRecibe: e.target.value.toUpperCase() })}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text" placeholder="Buscar jefe..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.nombreJefeTurnoDespacho}
                                                onChange={(e) => setFiltros({ ...filtros, nombreJefeTurnoDespacho: e.target.value.toUpperCase() })}
                                            />
                                        </td>
                                        <td className="border-b border-slate-200"></td>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos...</td></tr>
                                    ) : rows.length > 0 ? (
                                        rows.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">#{row.id}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-400 block lowercase first-letter:uppercase">
                                                            {row.fecha ? new Date(String(row.created_at)).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                        <span className="font-bold text-[10px] text-slate-800">
                                                            {row.fecha ? new Date(String(row.created_at)).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-[11px] font-bold text-slate-600 uppercase italic text-center">
                                                    {row.nombre_quien_entrega ?? "S/N"}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded uppercase tracking-tighter">
                                                        {row.nombre_quien_recibe ?? "-"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {row.validacion ? (
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                            {row.nombre_jefe_turno_despacho}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black rounded uppercase tracking-wider">
                                                            Sin validar
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {!row.validacion && (user?.isAdmin || user?.roles?.some(rol => rol.slug === "jefe_area")||user?.roles?.some(rol => rol.slug === "fbo")) && (
                                                            <button
                                                                onClick={() => setValidarId(row.id)}
                                                                className={`p-2 rounded transition-colors text-slate-400 hover:text-blue-600`}
                                                                title="Validar Entrega"
                                                            >
                                                                <ListCheck size={16} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => { setDetalleId(row.id); setDetalleOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Eye size={16} /></button>
                                                        {user?.isAdmin || user?.roles?.some(rol => rol.slug === "fbo") && (

                                                            <button onClick={() => setEditarId(row.id)} className={`p-2 rounded transition-colors text-slate-400 hover:text-blue-600`}><Edit2 size={16} /></button>
                                                        )}
                                                        {(user?.isAdmin ||( user?.roles?.some(rol => rol.slug === "jefe_area")||user?.roles?.some(rol => rol.slug === "fbo"))) && (
                                                            <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">
                                                                PDF
                                                            </button>
                                                        )}
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

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Mostrando {meta.from || 0} - {meta.to || 0} de {meta.total || 0}
                            </div>
                            <div className="flex gap-1 items-center">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    <ChevronLeft size={14} /> ANTERIOR
                                </button>
                                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>
                                <button
                                    disabled={page === meta.last_page}
                                    onClick={() => setPage(page + 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    SIGUIENTE <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {mostrarModalFecha && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMostrarModalFecha(false)}></div>
                    <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase text-slate-700">Período</h3>
                            <button onClick={() => setMostrarModalFecha(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {['dia', 'rango', 'mes', 'año'].map((modo) => (
                                    <button
                                        key={modo}
                                        onClick={() => setFiltrosEdicion({ ...filtrosEdicion, periodo: modo })}
                                        className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {modo}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                {filtrosEdicion.periodo === 'dia' && (
                                    <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        value={filtrosEdicion.fechaInicio}
                                        onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value, fechaFin: e.target.value })} />
                                )}
                                {filtrosEdicion.periodo === 'rango' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            value={filtrosEdicion.fechaInicio}
                                            onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value })} />
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            value={filtrosEdicion.fechaFin}
                                            onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaFin: e.target.value })} />
                                    </div>
                                )}
                                {filtrosEdicion.periodo === 'mes' && (
                                    <input type="month" className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) return;
                                            const [y, m] = val.split('-');
                                            setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-31` });
                                        }} />
                                )}
                                {filtrosEdicion.periodo === 'año' && (
                                    <input type="number" min="2020" max="2030" placeholder="Año"
                                        className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${e.target.value}-01-01`, fechaFin: `${e.target.value}-12-31` })} />
                                )}
                            </div>
                            <button
                                onClick={aplicarFiltroFecha}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {(isModalOpen || detalleOpen || editarId || validarId) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {isModalOpen ? 'Registrar Entrega de Turno' :
                                    detalleOpen ? 'Detalle de Turno' :
                                    editarId ? 'Editar Información' :
                                    validarId ? 'Validar Entrega de Turno' : ''}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Módulo de Operaciones Diarias</p>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setDetalleOpen(false); setEditarId(null); setValidarId(null); setFiltersOpen(false); }}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
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
                            {validarId && (
                                <EntregarTurnoEditar
                                    id={validarId}
                                    isValidar={true}
                                    onClose={() => setValidarId(null)}
                                    onSaved={() => { setValidarId(null); setPage(1); load({ page: 1 }); }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <EntregaTurnoPdfExporterReactPdf id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
