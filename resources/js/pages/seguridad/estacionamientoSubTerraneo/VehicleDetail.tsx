import React, { useEffect, useState } from 'react';
import { User, ChevronLeft, Loader2, CreditCard, LayoutGrid, CheckCircle2, Car, Plane } from 'lucide-react';
import { obtenerDetalleVehiculo } from '@/stores/apiEstacionamientoSubterraneo';

const VehicleDetail: React.FC<any> = ({ isOpen, onClose, selectedVehicle }) => {
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
                const key = item.matricula && item.matricula !== "N/A" ? item.matricula : "SIN MATRÍCULA";
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {});

            setDataAgrupada(agrupados);
            const matriculas = Object.keys(agrupados);
            if (matriculas.length > 0) {
                setActiveMatricula(matriculas[0]);
                setActiveSubIndex(0);
            }
        } catch (error) {
            setDataAgrupada({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) cargarDetalle();
    }, [isOpen, selectedVehicle]);

    const getDaysInMonth = (yearMonth: string) => {
        const [year, month] = yearMonth.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    if (!isOpen) return null;

    const totalDays = selectedVehicle ? getDaysInMonth(selectedVehicle) : 31;
    const vehiculosDeMatricula = activeMatricula ? dataAgrupada[activeMatricula] : [];
    const selectedData = vehiculosDeMatricula[activeSubIndex];

    const coloresModelos = [
        'bg-blue-600 border-blue-200 text-blue-600',
        'bg-purple-600 border-purple-200 text-purple-600',
        'bg-emerald-600 border-emerald-200 text-emerald-600',
        'bg-orange-600 border-orange-200 text-orange-600'
    ];

    return (
        <div className="w-full max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reporte Detallado</h1>
                        <p className="text-slate-500 text-sm font-medium">Periodo: {selectedVehicle}</p>
                    </div>
                </div>
                <div className="bg-slate-900 px-6 py-2.5 rounded-2xl text-white flex items-center gap-3">
                    <Plane size={18} className="text-blue-400" />
                    <span className="font-bold text-sm">{Object.keys(dataAgrupada).length} Matrículas Registradas</span>
                </div>
            </header>

            {loading ? (
                <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <aside className="lg:col-span-3 space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Listado de Matrículas</p>
                        {Object.keys(dataAgrupada).map((mat) => (
                            <button
                                key={mat}
                                onClick={() => { setActiveMatricula(mat); setActiveSubIndex(0); }}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${activeMatricula === mat ? 'bg-white border-blue-600 shadow-lg' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                            >
                                <div className={`p-2 rounded-lg ${activeMatricula === mat ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {mat === "SIN MATRÍCULA" ? <LayoutGrid size={18} /> : <Plane size={18} />}
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className={`text-sm font-black truncate text-slate-900}`}>
                                        {mat}
                                    </p>
                                    <p className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">
                                        {dataAgrupada[mat].length} {dataAgrupada[mat].length === 1 ? 'Vehículo' : 'Vehículos'}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </aside>

                    <main className="lg:col-span-9">
                        {selectedData ? (
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden h-full">
                                <div className="relative overflow-hidden bg-blue-900 p-8 text-white">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
                                    <div className="relative z-10">
                                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                            <div className="flex items-center gap-6">
                                                <div className="relative group">
                                                    <div className={`absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 ${coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0]}`}></div>
                                                    <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 ${coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0]}`}>
                                                        <Car size={32} strokeWidth={2.5} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h2 className={`text-3xl font-black tracking-tight 'text-white'}`}>
                                                            {activeMatricula}
                                                        </h2>
                                                        {activeMatricula !== "SIN MATRÍCULA" && (
                                                            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider">
                                                                Activo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                                                        <div className="flex items-center gap-2">
                                                            <CreditCard size={14} className="text-slate-400" />
                                                            <span className="text-slate-300 text-xs font-bold uppercase">Placa: {selectedData.id}</span>
                                                        </div>
                                                        <span className="hidden md:block text-slate-600">|</span>
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className="text-slate-400" />
                                                            <span className="text-slate-300 text-xs font-bold uppercase">{selectedData.nombre}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {vehiculosDeMatricula.length > 1 && (
                                                <div className="w-full lg:w-72">
                                                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-inner">
                                                        <label className="block text-[10px] font-black text-blue-400 mb-2 tracking-widest">
                                                            Registros bajo esta matrícula
                                                        </label>
                                                        <div className="relative group">
                                                            <select
                                                                value={activeSubIndex}
                                                                onChange={(e) => setActiveSubIndex(parseInt(e.target.value))}
                                                                className="w-full bg-slate-800/50 text-white text-xs font-bold py-2.5 pl-4 pr-10 rounded-xl border border-white/5 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                                            >
                                                                {vehiculosDeMatricula.map((v, idx) => (
                                                                    <option key={idx} value={idx} className="bg-slate-900">
                                                                        {v.id} - {v.nombre.split(' ')[0]}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-blue-400">
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
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-black text-slate-800 text-xs tracking-widest">Calendario de Asistencia</h3>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Presente</div>
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-200"></div> Ausente</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-[repeat(11,minmax(0,1fr))] gap-3">
                                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                                            const isActive = selectedData.asistencias.includes(day);
                                            const colorBase = coloresModelos[activeSubIndex % coloresModelos.length].split(' ')[0];
                                            return (
                                                <div
                                                    key={day}
                                                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${isActive
                                                        ? `${colorBase} text-white border-transparent shadow-md`
                                                        : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                                                >
                                                    <span className="text-[11px] font-black">{day}</span>
                                                    {isActive && <CheckCircle2 size={10} className="mt-1 opacity-70" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Días Totales</p>
                                            <p className="text-2xl font-black text-slate-900">{selectedData.asistencias.length}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">ID Vehículo (Placa)</p>
                                            <p className="text-sm font-black text-blue-600">{selectedData.id}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Registro</p>
                                            <p className="text-sm font-black text-slate-800">{selectedData.nombre}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400">
                                <p className="font-bold uppercase tracking-widest text-xs">Selecciona una matrícula</p>
                            </div>
                        )}
                    </main>
                </div>
            )}
        </div>
    );
};

export default VehicleDetail;
