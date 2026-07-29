import React, { useEffect, useMemo, useState } from 'react';
import { User, Loader2, CreditCard, LayoutGrid, CheckCircle2, Car, Plane, X } from 'lucide-react';
import { obtenerDetalleVehiculo } from '@/stores/apiEstacionamientoSubterraneo';

interface VehicleDetailProps {
    isOpen: boolean;
    onClose: () => void;
    selectedVehicle: string;
}

const VehicleDetail: React.FC<VehicleDetailProps> = ({ isOpen, onClose, selectedVehicle }) => {
    const [loading, setLoading] = useState(true);
    const [dataAgrupada, setDataAgrupada] = useState<Record<string, any[]>>({});
    const [activeMatricula, setActiveMatricula] = useState<string | null>(null);
    const [activeSubIndex, setActiveSubIndex] = useState(0);

    const cargarDetalle = async () => {
        if (!selectedVehicle) return;

        try {
            setLoading(true);

            const response = await obtenerDetalleVehiculo(selectedVehicle) as any;
            const rawData = Array.isArray(response) ? response : response.data || [];

            const agrupados = rawData.reduce((acc: any, item: any) => {
                const key = item.matricula && item.matricula !== 'N/A' ? item.matricula : 'SIN MATRÍCULA';

                if (!acc[key]) acc[key] = [];

                acc[key].push(item);

                return acc;
            }, {});

            setDataAgrupada(agrupados);

            const matriculasOrdenadasIniciales = Object.keys(
                agrupados,
            ).sort((matriculaA, matriculaB) => {
                const totalA = agrupados[matriculaA]?.length ?? 0;
                const totalB = agrupados[matriculaB]?.length ?? 0;

                if (totalB !== totalA) {
                    return totalB - totalA;
                }

                return matriculaA.localeCompare(
                    matriculaB,
                    'es',
                    {
                        sensitivity: 'base',
                    },
                );
            });

            if (matriculasOrdenadasIniciales.length > 0) {
                setActiveMatricula(
                    matriculasOrdenadasIniciales[0],
                );

                setActiveSubIndex(0);
            } else {
                setActiveMatricula(null);
                setActiveSubIndex(0);
            }
        } catch (error) {
            console.error(error);
            setDataAgrupada({});
            setActiveMatricula(null);
            setActiveSubIndex(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            cargarDetalle();
        }
    }, [isOpen, selectedVehicle]);

    const getDaysInMonth = (yearMonth: string) => {
        const [year, month] = yearMonth.split('-').map(Number);

        if (!year || !month) return 31;

        return new Date(year, month, 0).getDate();
    };

    if (!isOpen) return null;

    const totalDays = selectedVehicle ? getDaysInMonth(selectedVehicle) : 31;
    const vehiculosDeMatricula = activeMatricula ? dataAgrupada[activeMatricula] || [] : [];
    const selectedData = vehiculosDeMatricula[activeSubIndex];
    const matriculasOrdenadas = useMemo(() => {
        return Object.keys(dataAgrupada).sort((matriculaA, matriculaB) => {
            const totalA = dataAgrupada[matriculaA]?.length ?? 0;
            const totalB = dataAgrupada[matriculaB]?.length ?? 0;

            // Primero, ordenar de mayor a menor cantidad.
            if (totalB !== totalA) {
                return totalB - totalA;
            }

            // Si tienen la misma cantidad, ordenar alfabéticamente.
            return matriculaA.localeCompare(
                matriculaB,
                'es',
                {
                    sensitivity: 'base',
                },
            );
        });
    }, [dataAgrupada]);
    const coloresModelos = [
        'bg-blue-600 border-blue-200 text-blue-600',
        'bg-purple-600 border-purple-200 text-purple-600',
        'bg-emerald-600 border-emerald-200 text-emerald-600',
        'bg-orange-600 border-orange-200 text-orange-600',
    ];

    const asistencias = Array.isArray(selectedData?.asistencias) ? selectedData.asistencias : [];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div
                className="relative z-10 w-full max-w-7xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            Reporte Detallado
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Periodo: {selectedVehicle}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 px-4 py-2 rounded-xl text-white flex items-center gap-2">
                            <Plane size={16} className="text-blue-400" />
                            <span className="font-black text-[10px] uppercase tracking-tight">
                                {Object.keys(dataAgrupada).length} matrículas registradas
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                            title="Cerrar"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar bg-[#f3f4f6]">
                    {loading ? (
                        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-indigo-600" size={42} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Cargando detalle...
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <aside className="lg:col-span-3 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    Listado de matrículas
                                </p>

                                {matriculasOrdenadas.length > 0 ? (
                                    matriculasOrdenadas.map((mat) => (
                                        <button
                                            key={mat}
                                            type="button"
                                            onClick={() => {
                                                setActiveMatricula(mat);
                                                setActiveSubIndex(0);
                                            }}
                                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${activeMatricula === mat
                                                    ? 'bg-white border-indigo-500 shadow-sm'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div
                                                className={`p-2 rounded-lg ${activeMatricula === mat
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-500'
                                                    }`}
                                            >
                                                {mat === 'SIN MATRÍCULA' ? <LayoutGrid size={18} /> : <Plane size={18} />}
                                            </div>

                                            <div className="text-left overflow-hidden">
                                                <p className="text-sm font-black truncate text-slate-800">
                                                    {mat}
                                                </p>
                                                <p className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">
                                                    {dataAgrupada[mat].length} {dataAgrupada[mat].length === 1 ? 'vehículo' : 'vehículos'}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Sin matrículas
                                        </p>
                                    </div>
                                )}
                            </aside>

                            <main className="lg:col-span-9">
                                {selectedData ? (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
                                        <div className="relative overflow-hidden bg-slate-900 p-8 text-white">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32 rounded-full" />

                                            <div className="relative z-10">
                                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="relative group">
                                                            <div
                                                                className={`absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 ${coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0]
                                                                    }`}
                                                            />

                                                            <div
                                                                className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 ${coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0]
                                                                    }`}
                                                            >
                                                                <Car size={32} strokeWidth={2.5} />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h2 className="text-3xl font-black tracking-tight text-white">
                                                                    {activeMatricula}
                                                                </h2>

                                                                {activeMatricula !== 'SIN MATRÍCULA' && (
                                                                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-wider">
                                                                        Activo
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                                                                <div className="flex items-center gap-2">
                                                                    <CreditCard size={14} className="text-slate-400" />
                                                                    <span className="text-slate-300 text-xs font-bold uppercase">
                                                                        Placa: {selectedData.id}
                                                                    </span>
                                                                </div>

                                                                <span className="hidden md:block text-slate-600">|</span>

                                                                <div className="flex items-center gap-2">
                                                                    <User size={14} className="text-slate-400" />
                                                                    <span className="text-slate-300 text-xs font-bold uppercase">
                                                                        {selectedData.nombre}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {vehiculosDeMatricula.length > 1 && (
                                                        <div className="w-full lg:w-72">
                                                            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-inner">
                                                                <label className="block text-[10px] font-black text-indigo-300 mb-2 tracking-widest uppercase">
                                                                    Registros bajo esta matrícula
                                                                </label>

                                                                <div className="relative group">
                                                                    <select
                                                                        value={activeSubIndex}
                                                                        onChange={(e) => setActiveSubIndex(parseInt(e.target.value))}
                                                                        className="w-full bg-slate-800/50 text-white text-xs font-bold py-2.5 pl-4 pr-10 rounded-xl border border-white/5 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                                                    >
                                                                        {vehiculosDeMatricula.map((v, idx) => (
                                                                            <option key={idx} value={idx} className="bg-slate-900">
                                                                                {v.id} - {String(v.nombre || '').split(' ')[0]}
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-indigo-300">
                                                                        <LayoutGrid size={16} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8">
                                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">
                                                    Calendario de asistencia
                                                </h3>

                                                <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-600" />
                                                        Presente
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                                                        Ausente
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-[repeat(11,minmax(0,1fr))] gap-3">
                                                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                                                    const isActive = asistencias.includes(day);
                                                    const colorBase = coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0];

                                                    return (
                                                        <div
                                                            key={day}
                                                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${isActive
                                                                    ? `${colorBase} text-white border-transparent shadow-md`
                                                                    : 'bg-slate-50 border-slate-100 text-slate-300'
                                                                }`}
                                                        >
                                                            <span className="text-[11px] font-black">{day}</span>
                                                            {isActive && <CheckCircle2 size={10} className="mt-1 opacity-70" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                                                        Días totales
                                                    </p>
                                                    <p className="text-2xl font-black text-slate-900">
                                                        {asistencias.length}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                                                        ID vehículo
                                                    </p>
                                                    <p className="text-sm font-black text-indigo-600">
                                                        {selectedData.id}
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                                                        Nombre registro
                                                    </p>
                                                    <p className="text-sm font-black text-slate-800">
                                                        {selectedData.nombre}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="min-h-[55vh] flex items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                                        <p className="font-black uppercase tracking-widest text-xs">
                                            Selecciona una matrícula
                                        </p>
                                    </div>
                                )}
                            </main>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VehicleDetail;
