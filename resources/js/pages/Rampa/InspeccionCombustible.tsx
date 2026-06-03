import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import AppLayout from '@/layouts/app-layout';
import { exportarInspeccionesExcel } from './Combustible/components/excelService';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage} from '@inertiajs/react';
import { indexCombustible, apiEliminar, fetchInspeccionId, excelInspeccionCombustible } from '@/stores/apiInspeccionCombustible';
import PdfInspeccionCombustible from './Combustible/components/PdfInspeccionCombustible';
import PreviewInspeccionModal from './Combustible/components/PreviewInspeccionModal';
import Swal from 'sweetalert2';
import {
    Calendar,
    Image as ImageIcon,
    User,
    Edit2,
    Download,
    X,
    Filter,
    ChevronDown,
    Trash2,
    Loader2,
    Eye
} from 'lucide-react';
const Inspeccion = lazy(() => import('./Combustible/Inspeccion'));

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Inspección de Combustible' }];

interface InspeccionResumen {
    id: number;
    user_id: number;
    fecha: string;
    imagenes_count: number;
    user?: { name: string };
}
interface Role {
    slug: string;
    nombre: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
}

interface PageProps {
    auth: {
        user: AuthUser | null;
    };
    [key: string]: any;
}
export default function InspeccionCombustible() {
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;

    const [loading, setLoading] = useState(true);
    const [inspecciones, setInspecciones] = useState<InspeccionResumen[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [isEdit, setIsEdit] = useState(false);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [filtros, setFiltros] = useState({
        buscar: '',
        inspector: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia'
    });

    const cargarExcel = async () => {
        try {
            const data = await excelInspeccionCombustible({ ...filtros });
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error) {
            console.error("Error al obtener datos para Excel:", error);
            throw error;
        }
    };

    const handleExportarExcel = async () => {
        Swal.fire({
            title: 'Generando Excel',
            text: 'Estamos recopilando todos los registros, por favor espere...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const datosParaExcel = await cargarExcel();

            if (datosParaExcel.length === 0) {
                Swal.fire('Atención', 'No hay registros para exportar con los filtros seleccionados.', 'warning');
                return;
            }

            await exportarInspeccionesExcel(datosParaExcel);
            Swal.fire({
                icon: 'success',
                title: '¡Descarga lista!',
                text: 'El reporte se ha generado correctamente.',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al generar el archivo. Intente de nuevo.'
            });
        }
    };

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });
    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);

    useEffect(() => {
        if (mostrarModalFecha) setFiltrosEdicion({ ...filtros });
    }, [mostrarModalFecha, filtros]);

    const loadData = async () => {
        try {
            setLoading(true);
            const params = {
                page: pagina,
                per_page: 20,
                type: filtros.periodo,
                start: filtros.fechaInicio,
                end: filtros.fechaFin,
                id: filtros.buscar,
                inspector: filtros.inspector
            };
            const data = await indexCombustible(params);
            setInspecciones(data.data || []);
            setMeta(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [pagina, filtros]);

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setPagina(1);
    };

    const limpiarFiltros = () => {
        setFiltros({
            buscar: '',
            inspector: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia'
        });
    };

    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "El registro se marcará como inactivo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                const res = await apiEliminar(id);
                if (res.ok) {
                    Swal.fire({ icon: 'success', title: '¡Eliminado!', timer: 1500, showConfirmButton: false });
                    loadData();
                } else {
                    throw new Error(res.message);
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar', 'error');
            }
        }
    };

    const handleEdit = async (id: number) => {
        try {
            Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const dat = await fetchInspeccionId(id);
            setDetalle(dat);
            setIsEdit(true);
            setShowForm(true);
            Swal.close();
        } catch (error) {
            console.error(error);
        }
    };

    const handlePreview = async (id: number) => {
        try {
            Swal.fire({ title: 'Cargando Vista Previa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const dat = await fetchInspeccionId(id);
            setDetalle(dat);
            setShowPreview(true);
            Swal.close();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudieron recuperar las evidencias del servidor.', 'error');
        }
    };

    const formatFecha = (dateString: string) => {
        const date = new Date(dateString);
        const fecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
        const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
        return { fecha, hora };
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Control de Combustible" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen relative text-sm">
                <div className="space-y-4 animate-in fade-in duration-500">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Control de Combustible</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historial de Inspecciones Shell e Hydrokit</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>
                            <div className="w-[1px] bg-slate-200 mx-1"></div>
                            {(user?.roles?.[0]?.slug === 'admin2' || user?.roles?.[0]?.slug === 'fbo' || user?.roles?.[0]?.slug === 'admin') && (
                                <button
                                    onClick={handleExportarExcel}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-white text-slate-600 text-[10px] font-black px-3 py-2 rounded border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50"
                                    title="Descargar Excel"
                                >
                                    <Download size={14} className="text-green-600" />
                                    <span className="hidden md:inline">EXCEL</span>
                                </button>
                            )}
                            {user?.roles?.[0]?.slug !== 'admin2' && (
                                <button
                                    onClick={() => { setDetalle(null); setIsEdit(false); setShowForm(true); }}
                                    className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded shadow-md hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-wider"
                                >
                                    + NUEVA INSPECCIÓN
                                </button>
                            )}

                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-10">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha y Hora</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Inspector</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Evidencias</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={`bg-slate-50 border-b border-slate-200 overflow-hidden transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                        <td className="px-2 text-center">
                                            <button onClick={limpiarFiltros} className="text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 shadow-sm transition-colors">
                                                <div className="flex items-center gap-1 overflow-hidden font-bold text-slate-600 uppercase">
                                                    <Calendar size={12} className="text-blue-500" />
                                                    {filtros.periodo === 'dia' ? filtros.fechaInicio : filtros.periodo.toUpperCase()}
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="text" placeholder="Inspector..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 uppercase" value={filtros.inspector} onChange={(e) => setFiltros({ ...filtros, inspector: e.target.value.toUpperCase() })} />
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>

                                    {loading ? (
                                        <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin text-blue-500 mx-auto" size={32} /></td></tr>
                                    ) : inspecciones.map((row, index) => {
                                        const { fecha, hora } = formatFecha(row.fecha);
                                        const nFila = (pagina - 1) * 20 + (index + 1);
                                        return (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-4 text-center font-bold text-[10px] text-slate-400">{nFila}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 block">{fecha}</span>
                                                    <span className="text-sm font-black text-slate-700">{hora}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{row.user?.name || '---'}</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">ID: {row.user_id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded text-[9px] font-black border border-green-100 uppercase">
                                                        <ImageIcon size={10} /> {row.imagenes_count} FOTOS
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handlePreview(row.id)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] flex items-center gap-1 uppercase tracking-wider"
                                                            title="Vista Previa Rápida"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {(user?.isAdmin || user?.roles?.[0]?.slug === 'fbo') && (
                                                            <>
                                                                <button onClick={() => handleEdit(row.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                                                                <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">PDF</button>
                                                                <button onClick={() => handleEliminar(row.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                                            </>
                                                        )}
                                                        {user?.roles?.[0]?.slug === 'admin2'  && (
                                                            <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">PDF</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-500 uppercase">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                            <div className="flex gap-1">
                                <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 transition-colors">ANTERIOR</button>
                                <button disabled={pagina === meta.last_page} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 transition-colors">SIGUIENTE</button>
                            </div>
                        </div>
                    )}
                </div>
                {showForm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowForm(false)}></div>
                        <div className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">{isEdit ? 'Editar Inspección' : 'Nueva Inspección'}</h3>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Formulario de Calidad de Combustible</p>
                                </div>
                                <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={20} /></button>
                            </div>
                            <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                                <Suspense fallback={
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <Loader2 className="animate-spin text-blue-600" size={40} />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando Formulario...</p>
                                    </div>
                                }>
                                    <Inspeccion dataInitial={detalle} onSuccess={() => { setShowForm(false); loadData(); }} />
                                </Suspense>
                            </div>
                        </div>
                    </div>
                )}
                <PreviewInspeccionModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    detalle={detalle}
                    formatFecha={formatFecha}
                />
                {mostrarModalFecha && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMostrarModalFecha(false)}></div>
                        <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="text-sm font-black uppercase text-slate-700">Período</h3>
                                <button onClick={() => setMostrarModalFecha(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    {['dia', 'rango', 'mes', 'año'].map((modo) => (
                                        <button key={modo} onClick={() => setFiltrosEdicion({ ...filtrosEdicion, periodo: modo })} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{modo}</button>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    {filtrosEdicion.periodo === 'dia' && (
                                        <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaInicio} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value, fechaFin: e.target.value })} />
                                    )}
                                    {filtrosEdicion.periodo === 'rango' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaInicio} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: e.target.value })} />
                                            <input type="date" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={filtrosEdicion.fechaFin} onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaFin: e.target.value })} />
                                        </div>
                                    )}
                                    {filtrosEdicion.periodo === 'mes' && (
                                        <input type="month" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const [y, m] = e.target.value.split('-');
                                            setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${y}-${m}-01`, fechaFin: `${y}-${m}-31` });
                                        }} />
                                    )}
                                    {filtrosEdicion.periodo === 'año' && (
                                        <input type="number" min="2020" max="2030" placeholder="Año" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => setFiltrosEdicion({ ...filtrosEdicion, fechaInicio: `${e.target.value}-01-01`, fechaFin: `${e.target.value}-12-31` })} />
                                    )}
                                </div>
                                <button onClick={aplicarFiltroFecha} className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">Aplicar Filtro</button>
                            </div>
                        </div>
                    </div>
                )}

                <PdfInspeccionCombustible id={pdfId} onDone={() => setPdfId(null)} />
            </div>
        </AppLayout>
    );
}
