import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileEdit, Clock, User, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';

interface ReportePendiente {
    id: number;
    created_at: string;
    nombre_entrega: string;
    nombre_recibe: string;
    encabezado: {
        jefeTurno: string;
    };
    // Añade aquí otros campos que necesites mostrar
}
interface TablaProps {
    onSeleccionar: (reporte: any) => void;
}
const TablaJefeArea: React.FC<TablaProps> = ({ onSeleccionar }) => {
    const [reportes, setReportes] = useState<ReportePendiente[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReportesPendientes();
    }, []);

    const fetchReportesPendientes = async () => {
        try {
            const response = await axios.get('/api/EntregaTurnoR/pendientes-jefe');
            setReportes(response.data);
        } catch (error) {
            console.error("Error al cargar reportes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFirmar = (id: number) => {
        window.location.href = `/rampa/entrega-turno/${id}/editar`;
    };

    if (loading) return <div className="p-8 text-center font-bold text-slate-500">Cargando pendientes...</div>;

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h2 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2">
                    <Clock className="text-orange-500" /> Reportes Pendientes de Firma (Jefe)
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ID / Fecha</th>
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsables</th>
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {reportes.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="p-10 text-center text-slate-400 font-medium">
                                    No hay reportes pendientes de firma.
                                </td>
                            </tr>
                        ) : (
                            reportes.map((reporte) => (
                                <tr key={reporte.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700">#{reporte.id}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">
                                            {new Date(reporte.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-blue-500 uppercase">Entrega</span>
                                                <span className="text-sm font-bold text-slate-700">{reporte.nombre_entrega}</span>
                                            </div>
                                            <ArrowRight size={14} className="text-slate-300" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-emerald-500 uppercase">Recibe</span>
                                                <span className="text-sm font-bold text-slate-700">
                                                    {reporte.nombre_recibe || "SIN RECIBIR"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => onSeleccionar(reporte)}
                                            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
                                        >
                                            <FileEdit size={14} />
                                            REVISAR Y FIRMAR
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TablaJefeArea;
