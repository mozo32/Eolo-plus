import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import CheckListEquipoForm from './checkListEquipo/CheckListEquipoForm';
import { useState, useEffect, useCallback } from 'react';
import { fetchCheckListEquipo, fetchCheckUser, eliminar } from '@/stores/apiCheckListEquipoSeguridad';
import { Plus, Edit2, Filter, ChevronDown, Calendar, X, AlertCircle, Eye } from "lucide-react";
import PdfExporter from './checkListEquipo/components/PdfExporter';
import PendientesDrawer from './checkListEquipo/PendientesDrawer';
import PreviewModal from './checkListEquipo/components/PreviewModal';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'CheckList Equipo' }];
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
export default function CheckListEquipo() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [openPendientesDrawer, setOpenPendientesDrawer] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);

    // Estados para la Vista Previa
    const [openPreview, setOpenPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user?.roles[0]?.slug;
    const [filtros, setFiltros] = useState({
        buscar: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia'
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    useEffect(() => {
        if (mostrarModalFecha) setFiltrosEdicion({ ...filtros });
    }, [mostrarModalFecha, filtros]);

    const handleNuevoDesdePendiente = (usuario: any) => {
        setOpenPendientesDrawer(false);
        setIsEdit(false);
        setDetalle({
            data: {
                user_id: usuario.id,
                nombre: usuario.name || usuario.nombre,
                checklist: {},
                observaciones: ""
            }
        });
        setOpenForm(true);
    };

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setPagina(1);
    };

    const limpiarFiltros = () => {
        setFiltros({
            buscar: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia'
        });
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchCheckListEquipo({
                page: pagina,
                search: filtros.buscar,
                date: filtros.periodo === 'dia' ? filtros.fechaInicio : '',
                start_date: filtros.periodo !== 'dia' ? filtros.fechaInicio : '',
                end_date: filtros.periodo !== 'dia' ? filtros.fechaFin : '',
                per_page: 20,
            });
            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            cargarDatos();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [pagina, filtros]);

    const show = async (id: number) => {
        try {
            Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const dat = await fetchCheckUser(id);
            setDetalle(dat);
            setIsEdit(true);
            setOpenForm(true);
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'warning', title: 'Error', text: 'No se pudo cargar el registro.' });
        }
    };

    const handlePreview = async (id: number) => {
        try {
            Swal.fire({ title: 'Cargando Vista Previa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetchCheckUser(id);
            setPreviewData(res.data || res);
            setOpenPreview(true);
            Swal.close();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar la vista previa.' });
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setDetalle(null);
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
                const res = await eliminar(id);
                if (res.ok) {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'El registro ha sido borrado con éxito.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    cargarDatos();
                } else {
                    throw new Error(res.message || "Error al eliminar");
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar el registro', 'error');
            }
        }
    };

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList Equipo" />
            <div className="p-6 bg-[#f3f4f6] min-h-screen relative overflow-x-hidden">
                <div className="space-y-4 animate-in fade-in duration-500">

                    {/* Encabezado Principal */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Registros de Seguridad</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Checklist Equipo</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <Filter size={14} />
                                <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>
                            {user !== 'admin2' && (
                                <button
                                    onClick={() => setOpenPendientesDrawer(true)}
                                    className="bg-amber-500 text-white text-[10px] font-black px-4 py-2 rounded shadow-md hover:bg-amber-600 transition-all active:scale-95 uppercase tracking-wider flex items-center gap-2"
                                >
                                    <AlertCircle size={14} />
                                    <span>Pendientes</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabla de Registros */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-10">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha / Hora</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Responsable</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={`bg-slate-50 border-b border-slate-200 overflow-hidden transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                        <td className="px-2 py-2">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm">
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Calendar size={12} className="text-blue-500 shrink-0" />
                                                    <span className="truncate font-bold text-slate-600 uppercase">
                                                        {filtros.periodo === 'dia' ? filtros.fechaInicio : filtros.periodo === 'rango' ? `${filtros.fechaInicio} / ${filtros.fechaFin}` : filtros.periodo.toUpperCase()}
                                                    </span>
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="flex items-center gap-1 justify-center">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar responsable..."
                                                    className="w-full max-w-[240px] text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400"
                                                    value={filtros.buscar}
                                                    onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2"></td>
                                    </tr>

                                    {loading ? (
                                        <tr><td colSpan={4} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase">Cargando datos...</td></tr>
                                    ) : data.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase">No se encontraron registros con los filtros aplicados</td></tr>
                                    ) : data.map((row, index) => {
                                        const numeroFila = (pagina - 1) * (meta?.per_page || 20) + (index + 1);
                                        return (
                                            <tr key={`${row.id}-${index}`} className="border-b border-slate-50 transition-colors hover:bg-slate-50/80 border-l-4 border-l-transparent">
                                                <td className="px-4 py-4 text-center font-bold text-[10px] text-slate-400">{numeroFila}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[10px] font-bold text-slate-400 block">
                                                        {row.created_at ? new Date(row.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                                                    </span>
                                                    <span className="text-sm font-black text-slate-700">
                                                        {row.created_at ? new Date(row.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-500 uppercase">
                                                            {row.nombre?.charAt(0) || 'U'}
                                                        </div>
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{row.nombre || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => handlePreview(row.id)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Vista Previa">
                                                            <Eye size={16} />
                                                        </button>
                                                        {(user === 'admin' || user === 'fbo') && (
                                                            <button onClick={() => show(row.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}
                                                        {(user === 'admin' || user === 'fbo' || user === 'admin2') && (
                                                            <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors uppercase font-black text-[10px]" title="Descargar PDF">
                                                                PDF
                                                            </button>
                                                        )}
                                                        {(user === 'admin' || user === 'fbo') && (
                                                            <button onClick={() => handleEliminar(row.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Eliminar">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 3l18 18" /><path d="M4 7h3m4 0h9" /><path d="M10 11l0 6" /><path d="M14 14l0 3" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l.077 -.923" /><path d="M18.384 14.373l.616 -7.373" /><path d="M9 5v-1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Paginación */}
                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-500 uppercase">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                            <div className="flex gap-1">
                                <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">ANTERIOR</button>
                                <button disabled={pagina === meta.last_page} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">SIGUIENTE</button>
                            </div>
                        </div>
                    )}
                </div>

                <PendientesDrawer
                    isOpen={openPendientesDrawer}
                    onClose={() => setOpenPendientesDrawer(false)}
                    onSelectUser={handleNuevoDesdePendiente}
                />

                {/* Modal Flotante del Formulario */}
                {openForm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleBack}></div>
                        <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">{isEdit ? 'Editar Auditoría' : 'Nuevo Registro de Equipo'}</h3>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Formulario de Inspección</p>
                                </div>
                                <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={20} /></button>
                            </div>
                            <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                                <CheckListEquipoForm
                                    isEdit={isEdit}
                                    data={detalle?.data}
                                    onSuccess={() => {
                                        handleBack();
                                        cargarDatos();
                                        setOpenPendientesDrawer(false);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- AQUÍ REEMPLAZAMOS EL CÓDIGO VIEJO LLAMANDO AL NUEVO COMPONENTE EXTRAÍDO --- */}
                <PreviewModal
                    isOpen={openPreview}
                    onClose={() => setOpenPreview(false)}
                    previewData={previewData}
                />

                {/* Modal de Configuración de Rango de Fechas */}
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

                <PdfExporter id={pdfId} onDone={handlePdfDone} />
            </div>
        </AppLayout>
    );
}
