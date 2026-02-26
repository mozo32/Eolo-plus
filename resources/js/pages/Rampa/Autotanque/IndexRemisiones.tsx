import { fetchRemisionesDelDia } from "@/stores/apiAutoTanque"
import { useEffect, useState } from "react";

// Interfaces
interface Remision {
    id: number;
    folio: string;
    fecha: string;
    operador: string;
    unidad: string;
    producto: string;
    cliente: string;
    total_litros: string;
    status: string;
    matricula: string;
    hora_inicial: string;
    hora_final: string;
}

interface CierreTurno {
    id: number;
    entrega: string;
    recibe: string;
    diferencia: number;
    fecha: string;
    remisionesIds: string[]; // IDs vinculados
}

export default function IndexRemisiones() {
    const [activeTab, setActiveTab] = useState<'remisiones' | 'cierres'>('remisiones');
    const [remisiones, setRemisiones] = useState<Remision[]>([]);
    const [loading, setLoading] = useState(true);

    // Estado para el cierre seleccionado (para mostrar sus remisiones)
    const [cierreSeleccionado, setCierreSeleccionado] = useState<number | null>(null);

    // DATOS ESTÁTICOS PARA CIERRE DE TURNO
    const datosEstaticosCierres: CierreTurno[] = [
        { id: 1, entrega: "Juan Pérez", recibe: "Dora María", diferencia: 0.50, fecha: "2026-02-25", remisionesIds: ["EOLO-0002"] },
        { id: 2, entrega: "Carlos Ruiz", recibe: "Juan Pérez", diferencia: -1.20, fecha: "2026-02-24", remisionesIds: ["EOLO-0001"] },
    ];

    const obtenerFechaMexico = () => {
        const ahora = new Date();
        const opciones: Intl.DateTimeFormatOptions = { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Intl.DateTimeFormat('sv-SE', opciones).format(ahora).split(' ')[0];
    };

    const cargarDatosRemisiones = async (fechaManual?: string) => {
        setLoading(true);
        try {
            const data = await fetchRemisionesDelDia(fechaManual || obtenerFechaMexico());
            setRemisiones(Array.isArray(data) ? data : [data]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatosRemisiones();
    }, []);

    return (
        <div className="min-h-screen bg-[#fcfcfd] p-4 md:p-8 font-sans text-slate-900">
            <div className="max-w-6xl mx-auto">

                {/* HEADER CON TABS */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-8 h-1 bg-blue-600 rounded-full"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 italic">Eolo Workflow</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900">Panel Operativo</h1>

                        {/* Selector de Tabs */}
                        <div className="flex gap-8 mt-6 border-b border-slate-100">
                            <button
                                onClick={() => setActiveTab('remisiones')}
                                className={`pb-2 text-sm font-bold transition-all ${activeTab === 'remisiones' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Remisiones Diario
                            </button>
                            <button
                                onClick={() => setActiveTab('cierres')}
                                className={`pb-2 text-sm font-bold transition-all ${activeTab === 'cierres' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Cierres de Turno
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                        <div className="px-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase italic">Operando en</p>
                            <p className="text-sm font-black text-slate-700">{obtenerFechaMexico()}</p>
                        </div>
                        <button onClick={() => cargarDatosRemisiones()} className="bg-slate-900 text-white p-3 rounded-2xl hover:bg-blue-600 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </header>

                {/* CONTENIDO DE REMISIONES */}
                {activeTab === 'remisiones' && (
                    <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
                        {loading ? (
                            [1,2].map(i => <div key={i} className="h-32 w-full bg-slate-100 animate-pulse rounded-[2rem]"></div>)
                        ) : remisiones.map((item) => (
                            <RemisionCard key={item.id} item={item} />
                        ))}
                    </div>
                )}

                {/* CONTENIDO DE CIERRE DE TURNO */}
                {activeTab === 'cierres' && (
                    <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                        {datosEstaticosCierres.map((cierre) => (
                            <div key={cierre.id} className="group flex flex-col bg-white border border-slate-100 rounded-[2rem] overflow-hidden hover:shadow-xl transition-all">
                                <div
                                    onClick={() => setCierreSeleccionado(cierreSeleccionado === cierre.id ? null : cierre.id)}
                                    className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">ID Cierre #{cierre.id}</p>
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight">{cierre.fecha}</h3>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Entrega</p>
                                            <p className="text-sm font-bold text-slate-700">{cierre.entrega}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Recibe</p>
                                            <p className="text-sm font-bold text-slate-700">{cierre.recibe}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Diferencia</p>
                                            <p className={`text-xl font-black ${cierre.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {cierre.diferencia > 0 ? `+${cierre.diferencia}` : cierre.diferencia} <span className="text-[10px]">Lts</span>
                                            </p>
                                        </div>
                                        <div className={`transform transition-transform ${cierreSeleccionado === cierre.id ? 'rotate-180' : ''}`}>
                                            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* LISTA DE REMISIONES VINCULADAS (Desplegable) */}
                                {cierreSeleccionado === cierre.id && (
                                    <div className="bg-slate-50 p-6 border-t border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Remisiones vinculadas a este turno</p>
                                        <div className="space-y-2">
                                            {remisiones.filter(r => cierre.remisionesIds.includes(r.folio)).map(r => (
                                                <div key={r.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs font-black text-blue-600">{r.folio}</span>
                                                        <span className="text-xs font-bold text-slate-500">{r.cliente}</span>
                                                    </div>
                                                    <span className="text-sm font-black text-slate-700">{parseFloat(r.total_litros).toLocaleString()} Lts</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-componente para limpiar el código principal
function RemisionCard({ item }: { item: Remision }) {
    return (
        <div className="group relative bg-white border border-slate-100 rounded-[2rem] p-6 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-50 text-blue-600 w-14 h-14 rounded-2xl flex flex-col items-center justify-center border border-blue-100">
                        <span className="text-[10px] font-black leading-none mb-1 italic">REG</span>
                        <span className="text-lg font-black leading-none">{item.id}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">{item.folio}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${item.status === 'A' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {item.status === 'A' ? 'Suministro Activo' : 'Cancelado'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-8 lg:gap-12">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cliente / Aeronave</p>
                        <p className="text-sm font-bold text-slate-700">{item.cliente}</p>
                        <span className="inline-block px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded-md uppercase tracking-tighter">{item.matricula}</span>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cronometría</p>
                        <p className="text-sm font-bold text-slate-700">{item.hora_inicial.substring(0,5)} <span className="text-slate-300 mx-1">→</span> {item.hora_final.substring(0,5)}</p>
                        <p className="text-[10px] font-medium text-slate-400 italic">Ciclo operativo</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Responsable</p>
                        <p className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{item.operador}</p>
                        <p className="text-[10px] font-medium text-blue-600 uppercase tracking-widest font-black">{item.unidad}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end lg:min-w-[180px] border-t lg:border-t-0 pt-4 lg:pt-0">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 italic">Carga Neta</p>
                        <div className="flex items-baseline justify-end gap-1">
                            <span className="text-3xl font-black text-slate-900 tabular-nums leading-none">
                                {parseFloat(item.total_litros).toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-slate-400">Lts</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
