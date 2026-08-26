import { BreadcrumbItem } from '@/types';
import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import EntregarTurnoAutotanque from './Autotanque/EntregarTurnoAutotanque';
import { Download, Plus, X, Eye, Edit2, AlertCircle, ClipboardList, Filter, ChevronDown } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { fetchAutotanque, eliminarTurno, showAutotanque, fetchTurnoActivo, excelAutoTanqueApi } from '@/stores/apiAutoTanque';
import PdfExporterAutotanque from './Autotanque/PdfExporterAutotanque';
import ExcelAutotanqueModal from './Autotanque/ExcelAutotanqueModal';
import { CheckEstadoAutotanque } from './VerificacionEstadoAutotanque/CheckEstadoAutotanque';
import { DetalleTurnoAutotanque } from './Autotanque/DetalleTurnoAutotanque';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Reporte de Entrega de Turno' }];
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

export default function ReporteEntregaTurno() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [openForm, setOpenForm] = useState(false);
    const [tipoModal, setTipoModal] = useState<'entrega' | 'inspeccion' | 'preview'>('entrega');
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [turnoPendiente, setTurnoPendiente] = useState<any>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [mostrarExcelModal, setMostrarExcelModal] = useState(false);
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;
    const [filtros, setFiltros] = useState({
        id: '',
        responsable: '',
        estado: '',
        inspeccion: '',
        diferencia: '',
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia'
    });

    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchAutotanque({
                page,
                id: filtros.id,
                responsable: filtros.responsable,
                estado: filtros.estado,
                inspeccion: filtros.inspeccion,
                diferencia: filtros.diferencia,
                start: filtros.fechaInicio,
                end: filtros.fechaFin,
                per_page: 15
            });
            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const verificarTurnoActivo = async () => {
        try {
            const res = await fetchTurnoActivo();
            if (res?.active) setTurnoPendiente(res.data);
            else setTurnoPendiente(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setDetalle(null);
        verificarTurnoActivo();
        cargarDatos();
    };

    const limpiarFiltros = () => {
        setFiltros({
            id: '', responsable: '', estado: '', inspeccion: '', diferencia: '',
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia'
        });
    };

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setPage(1);
    };

    const cambiarPeriodoFecha = (
        modo: 'dia' | 'rango' | 'mes' | 'año'
    ) => {
        setFiltrosEdicion((actual) => {
            const ahora = new Date();
            const anioActual = ahora.getFullYear();
            const numeroMesActual = ahora.getMonth() + 1;
            const mesActual = String(numeroMesActual).padStart(2, '0');

            if (modo === 'mes') {
                const ultimoDia = new Date(
                    anioActual,
                    numeroMesActual,
                    0
                ).getDate();

                return {
                    ...actual,
                    periodo: modo,
                    fechaInicio: `${anioActual}-${mesActual}-01`,
                    fechaFin: `${anioActual}-${mesActual}-${String(
                        ultimoDia
                    ).padStart(2, '0')}`
                };
            }

            if (modo === 'año') {
                return {
                    ...actual,
                    periodo: modo,
                    fechaInicio: `${anioActual}-01-01`,
                    fechaFin: `${anioActual}-12-31`
                };
            }

            return {
                ...actual,
                periodo: modo
            };
        });
    };

    useEffect(() => {
        cargarDatos();
        verificarTurnoActivo();
    }, [page, filtros]);

    const handleAccionReporte = () => {
        setTipoModal('entrega');
        if (turnoPendiente) setDetalle(turnoPendiente);
        else setDetalle(null);
        setOpenForm(true);
    };

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                const res = await eliminarTurno(id);
                if (res.ok) {
                    Swal.fire({ title: '¡Eliminado!', icon: 'success', timer: 1500, showConfirmButton: false });
                    cargarDatos();
                    verificarTurnoActivo();
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    const show = async (id: number, tipo: 'entrega' | 'inspeccion' | 'preview') => {
        try {
            const dat = await showAutotanque(id);
            setDetalle(dat);
            setTipoModal(tipo);
            setOpenForm(true);
        } catch (error) { console.error(error); }
    };

    const cargarExcel = useCallback(async () => {
        try {
            const data = await excelAutoTanqueApi({ ...filtros });
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error) {
            console.error("Error al obtener datos para Excel:", error);
            throw error;
        }
    }, [filtros]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reporte de Entrega de Turno" />
            <div className="p-6 bg-[#f3f4f6] min-h-screen relative">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Autotanque</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Reporte de entrega de turno</p>
                        </div>

                        <div className="flex gap-2">
                            {turnoPendiente && (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1 rounded animate-pulse mr-2">
                                    <AlertCircle size={12} className="text-amber-600" />
                                    <span className="text-[9px] font-black text-amber-700 uppercase">Turno abierto detectado</span>
                                </div>
                            )}
                            <>
                                <div className="w-[1px] bg-slate-200 mx-1"></div>
                                <button
                                    onClick={() => setMostrarExcelModal(true)}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-white text-slate-600 text-[10px] font-black px-3 py-2 rounded border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50"
                                    title="Vista previa del Excel"
                                >
                                    <Download size={14} className="text-green-600" />
                                    <span className="hidden md:inline">EXCEL</span>
                                </button>
                            </>
                            <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${mostrarFiltros ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                <Filter size={14} />
                                <span>{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>
                            {user?.roles?.[0]?.slug !== 'admin2' && (
                                <button onClick={handleAccionReporte} className={`text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white ${turnoPendiente ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}>
                                    {turnoPendiente ? 'CONTINUAR / CERRAR TURNO' : '+ NUEVO REPORTE'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[950px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">#</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Responsable</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Estado Turno</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Inspección</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha / Hora</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Diferencia</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className={`bg-slate-50 border-b border-slate-200 transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                        <td className="px-2 py-2 text-center">
                                            <div className="flex items-center gap-1 justify-center">
                                                <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
                                                <input type="text" placeholder="ID" className="w-16 text-[10px] border border-slate-200 p-1 rounded bg-white outline-none" value={filtros.id} onChange={(e) => setFiltros({ ...filtros, id: e.target.value })} />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="text" placeholder="Buscar responsable..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white uppercase font-bold" value={filtros.responsable} onChange={(e) => setFiltros({ ...filtros, responsable: e.target.value })} />
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <select className="text-[10px] border border-slate-200 p-1 rounded bg-white font-bold" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
                                                <option value="">TODOS</option>
                                                <option value="1">FINALIZADO</option>
                                                <option value="0">PENDIENTE</option>
                                            </select>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <select className="text-[10px] border border-slate-200 p-1 rounded bg-white font-bold" value={filtros.inspeccion} onChange={(e) => setFiltros({ ...filtros, inspeccion: e.target.value })}>
                                                <option value="">TODOS</option>
                                                <option value="1">OK</option>
                                                <option value="0">FALTA</option>
                                            </select>
                                        </td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white shadow-sm hover:border-indigo-400 transition-colors">
                                                <span className="truncate font-black text-slate-600 uppercase">{filtros.periodo === 'dia' ? filtros.fechaInicio : 'RANGO'}</span>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>
                                        <td className="px-2 py-2">
                                            <input type="number" placeholder="Lts..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white font-bold" value={filtros.diferencia} onChange={(e) => setFiltros({ ...filtros, diferencia: e.target.value })} />
                                        </td>
                                        <td className="px-2 py-2"></td>
                                    </tr>

                                    {loading ? (
                                        <tr><td colSpan={7} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos...</td></tr>
                                    ) : data.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">#{row.id}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{row.nombre || 'N/A'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black border uppercase ${row.finalizado ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    <div className={`w-1 h-1 rounded-full ${row.finalizado ? 'bg-blue-500' : 'bg-amber-500 animate-pulse'}`} />
                                                    {row.finalizado ? 'Finalizado' : 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black border uppercase ${row.tiene_inspeccion ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                    {row.tiene_inspeccion ? 'OK' : 'FALTA'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-[10px]">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-400">{row.fecha ? new Date(row.fecha.split(' ')[0] + 'T12:00:00').toLocaleDateString('es-MX') : 'N/A'}</span>
                                                    <span className="font-black text-slate-700 uppercase">{row.fecha && row.fecha.includes(' ') ? row.fecha.split(' ')[1].substring(0, 5) : '--:--'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono text-xs font-black">
                                                <span className={row.diferenciaFinal < 0 ? 'text-red-600' : 'text-slate-600'}>
                                                    {Number(row.diferenciaFinal || 0).toLocaleString('en-US')} <small className="text-[9px]">LTS</small>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    {user?.roles?.[0]?.slug === 'admin2' || (!row.tiene_inspeccion) && (
                                                        <button onClick={() => show(row.id, 'inspeccion')} className="p-2 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Inspección"><ClipboardList size={16} /></button>
                                                    )}
                                                    <button
                                                        onClick={() => show(row.id, 'preview')}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                                        title="Vista Previa"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    { user?.roles?.[0]?.slug !== 'admin2' && (
                                                        <button onClick={() => show(row.id, 'entrega')} className={`p-2 rounded transition-colors ${!row.finalizado ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:text-blue-600'}`}><Edit2 size={16} /></button>
                                                    )}
                                                    {(user?.isAdmin || user?.roles?.[0]?.slug === 'fbo') && (
                                                        <>
                                                            <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">PDF</button>
                                                            <button onClick={() => handleEliminar(row.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><X size={16} /></button>
                                                        </>
                                                    )}
                                                    {(user?.roles?.[0]?.slug === 'admin2') && (
                                                        <>
                                                            <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]">PDF</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-500 uppercase">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                            <div className="flex gap-1">
                                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 tracking-tighter">ANTERIOR</button>
                                <button disabled={page === meta.last_page} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 tracking-tighter">SIGUIENTE</button>
                            </div>
                        </div>
                    )}
                </div>

                {openForm && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleBack}></div>
                        <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                        {tipoModal === 'inspeccion' ? 'Verificación de Estado' :
                                        tipoModal === 'preview' ? `Resumen de Turno #${detalle?.turno?.id || ''}` :
                                        (detalle ? 'Finalizar Turno' : 'Nuevo Reporte')}
                                    </h3>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                        {tipoModal === 'inspeccion' ? 'Inspección de combustible' : 'Entrega de turno autotanque'}
                                    </p>
                                </div>
                                <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={20} /></button>
                            </div>
                            <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                                {tipoModal === 'inspeccion' ? (
                                    <CheckEstadoAutotanque data={detalle} onSuccess={() => { handleBack(); cargarDatos(); }} />
                                ) : tipoModal === 'preview' ? (
                                    <DetalleTurnoAutotanque data={detalle} />
                                ) : (
                                    <EntregarTurnoAutotanque initialData={detalle} onSuccess={() => { handleBack(); cargarDatos(); }} />
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
                                    {(['dia', 'rango', 'mes', 'año'] as const).map((modo) => (
                                        <button type="button" key={modo} onClick={() => cambiarPeriodoFecha(modo)} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{modo}</button>
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
                                        <input type="month" value={filtrosEdicion.fechaInicio.substring(0, 7)} className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const valor = e.target.value;

                                            if (!valor) {
                                                setFiltrosEdicion({
                                                    ...filtrosEdicion,
                                                    fechaInicio: '',
                                                    fechaFin: ''
                                                });
                                                return;
                                            }

                                            const [anioTexto, mesTexto] = valor.split('-');
                                            const anio = Number(anioTexto);
                                            const mes = Number(mesTexto);
                                            const ultimoDia = new Date(anio, mes, 0).getDate();

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: `${valor}-01`,
                                                fechaFin: `${valor}-${String(ultimoDia).padStart(2, '0')}`
                                            });
                                        }} />
                                    )}
                                    {filtrosEdicion.periodo === 'año' && (
                                        <input type="number" min="2020" max="2100" value={filtrosEdicion.fechaInicio ? filtrosEdicion.fechaInicio.split('-')[0] : ''} placeholder="Año" className="w-full border border-slate-200 p-2 rounded-lg text-sm" onChange={(e) => {
                                            const anio = e.target.value;

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: anio ? `${anio}-01-01` : '',
                                                fechaFin: anio ? `${anio}-12-31` : ''
                                            });
                                        }} />
                                    )}
                                </div>
                                <button onClick={aplicarFiltroFecha} className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors">Aplicar Filtro</button>
                            </div>
                        </div>
                    </div>
                )}

                <PdfExporterAutotanque id={pdfId} onDone={handlePdfDone} />

                <ExcelAutotanqueModal
                    open={mostrarExcelModal}
                    onClose={() => setMostrarExcelModal(false)}
                    cargarRegistros={cargarExcel}
                />
            </div>
        </AppLayout>
    );
}
