import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, User, X, Zap, Loader2 } from 'lucide-react';
import { obtenerDetalleVehiculo } from '@/stores/apiEstacionamientoSubterraneo';

interface VehicleDetailProps {
    isOpen: boolean;
    onClose: () => void;
    selectedVehicle: string;
}

const VehicleDetail: React.FC<VehicleDetailProps> = ({ isOpen, onClose, selectedVehicle }) => {
    const [loading, setLoading] = useState(true);
    const [dataMes, setDataMes] = useState<any[]>([]);

    const cargarDetalle = async () => {
        if (!selectedVehicle) return;
        try {
            setLoading(true);
            const response = await obtenerDetalleVehiculo(selectedVehicle) as any;
            const dataLlegada = Array.isArray(response) ? response : response.data;
            setDataMes(Array.isArray(dataLlegada) ? dataLlegada : []);
        } catch (error) {
            console.error("Error cargando detalle:", error);
            setDataMes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) cargarDetalle();
    }, [isOpen, selectedVehicle]);

    // Calcular días reales del mes (ej. febrero 2026 = 28 días)
    const getDaysInMonth = (yearMonth: string) => {
        const [year, month] = yearMonth.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    const totalDays = selectedVehicle ? getDaysInMonth(selectedVehicle) : 31;
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-[#f8fafc] w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl border border-white flex flex-col animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-8 py-6 bg-white border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest mb-1">
                            <Calendar size={14} />
                            <span>Reporte de Mensualidad</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 capitalize">
                            {selectedVehicle} {/* Muestra 2026-02 */}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-500 transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="animate-spin mb-4" size={40} />
                            <p className="font-bold uppercase tracking-widest text-xs">Procesando datos...</p>
                        </div>
                    ) : dataMes.length > 0 ? (
                        dataMes.map((item) => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                                <div className="flex justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 uppercase">{item.nombre}</h3>
                                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                                                {item.id || 'SIN MATRÍCULA'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-black uppercase">Presencia</p>
                                        <p className="text-xl font-black text-blue-600">
                                            {Math.round((item.asistencias.length / totalDays) * 100)}%
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-2">
                                    {daysArray.map((day) => {
                                        const active = item.asistencias.includes(day);
                                        return (
                                            <div
                                                key={day}
                                                className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all
                                                    ${active
                                                        ? 'bg-green-500 text-white shadow-md shadow-green-200 scale-105'
                                                        : 'bg-slate-50 text-slate-300 border border-slate-100'}`}
                                            >
                                                {day}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-slate-400 italic">
                            No hay vehículos registrados en este periodo.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default VehicleDetail;
