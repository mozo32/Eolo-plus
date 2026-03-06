import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    FileEdit,
    Search,
    ExternalLink,
    Circle,
    Calendar as CalendarIcon
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
}
interface TablaProps {
    onSeleccionar: (reporte: any) => void;
}
const TablaJefeArea: React.FC<TablaProps> = ({ onSeleccionar }) => {
    const [reportes, setReportes] = useState<ReportePendiente[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [turno, setTurno] = useState<any>(null);

    useEffect(() => {
        fetchReportesPendientes();
    }, [currentPage, searchTerm, filterDate]);

    const fetchReportesPendientes = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/EntregaTurnoR/entrega-turno-rampa', {
                params: {
                    page: currentPage,
                    search: searchTerm,
                    date: filterDate
                }
            });
            const result = response.data;
            setReportes(result.data || []);
            setLastPage(result?.last_page || 1);
            setTotalResults(result?.total || 0);
        } catch (error) {
            console.error("Error cargando reportes:", error);
            setReportes([]);
        } finally {
            setLoading(false);
        }
    };
    const fetchReportesShow = async (id: any) => {
        try {
            const response = await axios.get(`/api/EntregaTurnoR/${id}`);
            const result = response;
            setTurno(result.data);
            onSeleccionar(result.data)
        } catch (error) {
            console.error("Error al consultar", error);
        } finally {
            setLoading(false);
        }
    };
    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setCurrentPage(1);
    };

    const handleDateChange = (val: string) => {
        setFilterDate(val);
        setCurrentPage(1);
    };
    return (
        <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Control de Entregas de Turnos</h1>
                        <p className="text-sm text-slate-500">Gestión de reportes operativos.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="date"
                                value={filterDate}
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm text-slate-600 transition-all"
                                onChange={(e) => handleDateChange(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar ID o Jefe..."
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 shadow-sm"
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                            <div className="flex items-center gap-3 text-indigo-600 font-medium">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                                Actualizando...
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-6 py-4 border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">ID</th>
                                    <th className="px-6 py-4 border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">Fecha</th>
                                    <th className="px-6 py-4 border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">Jefe de Turno</th>
                                    <th className="px-6 py-4 border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">Entrega</th>
                                    <th className="px-6 py-4 border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">Estatus Recibe</th>
                                    <th className="px-6 py-4 border-b border-slate-200 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportes.length > 0 ? (
                                    reportes.map((reporte) => (
                                        <tr key={reporte.id} className="group hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">#{reporte.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{reporte.encabezado?.fecha}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{reporte.encabezado?.jefeTurno}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{reporte.nombre_entrega}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Circle size={8} className={!reporte.nombre_recibe ? 'fill-amber-500 text-amber-500' : 'fill-emerald-500 text-emerald-500'} />
                                                    <span className={`text-sm font-bold ${!reporte.nombre_recibe ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                        {reporte.nombre_recibe || 'Pendiente'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        onClick={() => {
                                                            fetchReportesShow(reporte.id);
                                                        }}
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="#007aff"
                                                            stroke-width="1.75"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                        >
                                                            <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                                                            <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                                                            <path d="M16 5l3 3" />
                                                        </svg>
                                                    </button>
                                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="20"
                                                            height="20"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="#cf4ee9"
                                                            stroke-width="1.75"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                        >
                                                            <path d="M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                        onClick={async () => {
                                                            setLoading(true);
                                                            try {
                                                                const response = await axios.get(`/api/EntregaTurnoR/${reporte.id}`);
                                                                const dataFull = response.data;
                                                                console.log(dataFull);

                                                                const blob = await pdf(<ReportePDF data={dataFull} />).toBlob();
                                                                const url = URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `Reporte_Rampa_${reporte.id}.pdf`;
                                                                document.body.appendChild(link);
                                                                link.click();

                                                                document.body.removeChild(link);
                                                                URL.revokeObjectURL(url);
                                                            } catch (error) {
                                                                console.error("Error generando PDF", error);
                                                                alert("Error al generar el archivo PDF.");
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                                                            <path d="M7 11l5 5l5 -5" />
                                                            <path d="M12 4l0 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-slate-400 italic">
                                            {!loading && "No se encontraron registros."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            Mostrando {reportes.length} de {totalResults} resultados
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all text-sm font-bold text-slate-700"
                            >
                                Anterior
                            </button>
                            <button
                                disabled={currentPage === lastPage || loading}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all text-sm font-bold text-slate-700"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TablaJefeArea;
