import React, { useEffect, useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import VistaFirmas from './secciones/VistaFirmas';
import DetalleReporteRampa from './secciones/DetalleReporteRampa';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    Plus,
    Circle,
    Calendar as CalendarIcon,
    X,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Filter,
    Calendar,
    ChevronDown,
    PenTool,
    Eye
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import ReportePDF from './secciones/ReportePDF';

interface ReportePendiente {
    id: number;
    created_at: string;
    nombre_entrega: string;
    nombre_recibe: string | null;
    encabezado: {
        fecha: string;
        jefeTurno: string;
    };
    firmas?: { id: number; path: string; pivot: { rol: string } }[];
}

interface TablaProps {
    onSeleccionar: (reporte: any) => void;
    onNuevoRegistro: () => void;
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
const TablaJefeArea: React.FC<TablaProps> = ({ onSeleccionar, onNuevoRegistro }) => {
    const [reportes, setReportes] = useState<ReportePendiente[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [reporteParaFirmas, setReporteParaFirmas] = useState<any>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [reporteParaDetalle, setReporteParaDetalle] = useState<any>(null);

    const handleVerDetalle = async (id: number) => {
        Swal.fire({
            title: 'Cargando detalle...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const response = await axios.get(`/api/EntregaTurnoR/${id}`);
            setReporteParaDetalle(response.data);
            Swal.close();
        } catch (error) {
            Swal.fire('Error', 'No se pudo obtener la información.', 'error');
        }
    };
    const handleAbrirFirmas = async (id: number) => {
        Swal.fire({
            title: 'Consultando reporte',
            text: 'Cargando módulo de firmas...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const response = await axios.get(`/api/EntregaTurnoR/${id}`);
            setReporteParaFirmas(response.data);
            Swal.close();
        } catch (error) {
            Swal.fire('Error', 'No se pudo cargar el reporte.', 'error');
        }
    };
    const [filtros, setFiltros] = useState({
        fechaInicio: new Date().toLocaleDateString('en-CA'),
        fechaFin: new Date().toLocaleDateString('en-CA'),
        periodo: 'dia',
        nombreEntrega: '',
        nombreRecibe: '',
        jefeTurno: ''
    });
    const handleGenerarPDF = async (reporteId: number) => {
        Swal.fire({
            title: 'Generando PDF',
            text: 'Preparando el reporte operativo de rampa...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const response = await axios.get(`/api/EntregaTurnoR/${reporteId}`);
            const blob = await pdf(<ReportePDF data={response.data} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reporte_Rampa_${reporteId}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            Swal.close();

        } catch (error) {
            console.error("Error al generar PDF:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo generar el archivo PDF.',
                confirmButtonColor: '#1e293b'
            });
        }
    };
    const [filtrosEdicion, setFiltrosEdicion] = useState({ ...filtros });

    useEffect(() => {
        fetchReportesPendientes();
    }, [currentPage, searchTerm, filtros]);

    useEffect(() => {
        if (mostrarModalFecha) {
            setFiltrosEdicion({ ...filtros });
        }
    }, [mostrarModalFecha, filtros]);

    const fetchReportesPendientes = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/EntregaTurnoR/entrega-turno-rampa', {
                params: {
                    page: currentPage,
                    search: searchTerm,
                    ...filtros
                }
            });
            const result = response.data;
            setReportes(result.data || []);
            setLastPage(result?.last_page || 1);
            setTotalResults(result?.total || 0);
        } catch (error) {
            console.error("Error cargando reportes:", error);
        } finally {
            setLoading(false);
        }
    };

    const aplicarFiltroFecha = () => {
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
        setCurrentPage(1);
    };

    const limpiarFiltros = () => {
        setFiltros({
            fechaInicio: new Date().toLocaleDateString('en-CA'),
            fechaFin: new Date().toLocaleDateString('en-CA'),
            periodo: 'dia',
            nombreEntrega: '',
            nombreRecibe: '',
            jefeTurno: ''
        });
        setSearchTerm("");
        setCurrentPage(1);
    };

    const fetchReportesShow = async (id: any) => {
        try {
            const response = await axios.get(`/api/EntregaTurnoR/${id}`);
            onSeleccionar(response.data);
        } catch (error) {
            console.error("Error al consultar", error);
        }
    };

    const obtenerEstadoFirma = (reporte: ReportePendiente, rolBuscado: string, nombreFallback: string | null) => {
        const tieneFirma = reporte.firmas?.some(f => f.pivot.rol === rolBuscado);

        return {
            firmado: tieneFirma,
            nombre: tieneFirma ? nombreFallback : 'Pendiente'
        };
    };

    const { auth } = usePage<PageProps>().props;
    const user = auth?.user?.roles[0]?.slug;
    const puedeEditar = user === 'admin' || user === 'fbo';

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Control de Entregas</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gestión de reportes operativos de rampa</p>
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
                        onClick={onNuevoRegistro}
                        className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center gap-2"
                    >
                        <Plus size={14} />
                        NUEVO REGISTRO
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">#</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Encargado de Turno</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Entrega Turno</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Recibe Turno</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                            </tr>

                            <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                <td className="px-4 py-2 border-b border-slate-200 text-center">
                                    <button onClick={limpiarFiltros} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                        <X size={14} />
                                    </button>
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <button
                                        onClick={() => setMostrarModalFecha(true)}
                                        className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm"
                                    >
                                        <div className="flex items-center gap-1 overflow-hidden text-center justify-center w-full">
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
                                        type="text" placeholder="BUSCAR JEFE..."
                                        className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold"
                                        value={filtros.jefeTurno}
                                        onChange={(e) => setFiltros({ ...filtros, jefeTurno: e.target.value.toUpperCase() })}
                                    />
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <input
                                        type="text" placeholder="BUSCAR ENTREGA..."
                                        className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold"
                                        value={filtros.nombreEntrega}
                                        onChange={(e) => setFiltros({ ...filtros, nombreEntrega: e.target.value.toUpperCase() })}
                                    />
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <input
                                        type="text" placeholder="BUSCAR RECIBE..."
                                        className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold"
                                        value={filtros.nombreRecibe}
                                        onChange={(e) => setFiltros({ ...filtros, nombreRecibe: e.target.value.toUpperCase() })}
                                    />
                                </td>
                                <td className="border-b border-slate-200"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : reportes.length > 0 ? (
                                reportes.map((reporte) => (
                                    <tr key={reporte.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-4 text-center font-black text-[10px] text-indigo-600">#{reporte.id}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-bold text-[10px] text-slate-800 uppercase">
                                                {reporte.encabezado?.fecha ? reporte.encabezado.fecha.split('-').reverse().join('/') : 'S/F'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const estado = obtenerEstadoFirma(reporte, 'jefe_rampa', reporte.encabezado?.jefeTurno);
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${!estado.firmado ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        }`}>
                                                        <Circle size={6} className={!estado.firmado ? 'fill-amber-500' : 'fill-emerald-500'} />
                                                        {estado.nombre}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const estado = obtenerEstadoFirma(reporte, 'quien_entrega', reporte.nombre_entrega);
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${!estado.firmado ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        }`}>
                                                        <Circle size={6} className={!estado.firmado ? 'fill-amber-500' : 'fill-emerald-500'} />
                                                        {estado.nombre}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const estado = obtenerEstadoFirma(reporte, 'quien_recibe', reporte.nombre_recibe);
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${!estado.firmado ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        }`}>
                                                        <Circle size={6} className={!estado.firmado ? 'fill-amber-500' : 'fill-emerald-500'} />
                                                        {estado.nombre}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {puedeEditar && (
                                                    <button
                                                        onClick={() => fetchReportesShow(reporte.id)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleVerDetalle(reporte.id)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="Ver Detalle Completo"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                {(reporte.firmas?.length ?? 0) < 3 && (
                                                    <button
                                                        onClick={() => handleAbrirFirmas(reporte.id)}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 animate-in zoom-in"
                                                        title="Gestionar Firmas"
                                                    >
                                                        <PenTool size={16} />
                                                        <span className="text-[9px] font-bold">
                                                            {reporte.firmas?.length ?? 0}/3
                                                        </span>
                                                    </button>
                                                )}
                                                {puedeEditar && (
                                                    <button
                                                        onClick={() => handleGenerarPDF(reporte.id)}
                                                        className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px] flex items-center gap-1 transition-colors"
                                                    >
                                                        PDF
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        No se encontraron registros
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {lastPage > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Total: {totalResults} resultados
                    </div>
                    <div className="flex gap-1 items-center">
                        <button
                            disabled={currentPage === 1 || loading}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                        >
                            <ChevronLeft size={14} /> ANTERIOR
                        </button>
                        <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                            PÁGINA {currentPage} DE {lastPage}
                        </span>
                        <button
                            disabled={currentPage === lastPage || loading}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                        >
                            SIGUIENTE <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {mostrarModalFecha && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMostrarModalFecha(false)}></div>
                    <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
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
                                className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors shadow-lg"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {reporteParaFirmas && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase text-slate-800 tracking-tighter">Panel de Firmas</h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase">Reporte #{reporteParaFirmas.id} - Rampa</p>
                            </div>
                            <button onClick={() => setReporteParaFirmas(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24} /></button>
                        </div>

                        <VistaFirmas
                            reporteData={reporteParaFirmas}
                            onClose={() => setReporteParaFirmas(null)}
                            onSuccess={fetchReportesPendientes} // Refresca la tabla al guardar
                        />
                    </div>
                </div>
            )}
            {reporteParaDetalle && (
                <DetalleReporteRampa
                    data={reporteParaDetalle}
                    onClose={() => setReporteParaDetalle(null)}
                />
            )}
        </div>
    );
};

export default TablaJefeArea;
