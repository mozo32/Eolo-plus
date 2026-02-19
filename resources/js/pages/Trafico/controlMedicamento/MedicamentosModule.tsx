import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Pill, History, UserPlus, Archive } from 'lucide-react';
import { AuthUser, ViewType, Medicamento } from './types';
import InventoryTable from './InventoryTable';
import ActionForms from './ActionForms';
import { fetchMedicamentos, movimientos } from '@/stores/apiControlMedicamento';

const MedicamentosModule = () => {
    const [view, setView] = useState<ViewType>('entrega');
    const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
    const [moviemientos, setMovimientos] = useState([]);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const fetchActivos = async () => {
        try {
            const data = await fetchMedicamentos();
            setMedicamentos(data);
        } catch (error) {
            console.error("Error cargando medicamentos:", error);
        }
    };
    const fetchMoviminetos = async () => {
        try {
            const data = await movimientos();
            setMovimientos(data);
        } catch (error) {
            console.error("Error cargando los movimientos:", error);
        }
    };

    useEffect(() => { fetchActivos(); }, []);
    useEffect(() => { fetchMoviminetos(); }, []);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
                            <Pill className="text-blue-600" size={32} /> Control Médico
                        </h1>
                        <p className="text-slate-500 font-medium italic">Gestión de insumos y medicamentos</p>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        {(['entrega', 'inventario', 'cierre'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-6 py-2.5 rounded-xl font-bold transition-all uppercase ${view === v ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}
                            >
                                {v === 'inventario' ? 'Reabastecer' : v === 'cierre' ? 'Corte/Cierre' : v}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <ActionForms
                            view={view}
                            medicamentos={medicamentos}
                            onSuccess={() => {
                                fetchActivos();
                                fetchMoviminetos();
                            }}
                        />
                        <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl">
                            <h3 className="font-black uppercase tracking-tighter text-slate-400 mb-4 flex items-center gap-2">
                                <History size={18} /> Últimos Movimientos
                            </h3>
                            <div className="space-y-3">
                                {moviemientos.map((mov: any) => (
                                    <div key={mov.id} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                                    ${mov.tipo === 'CIERRE' ? 'bg-orange-500/20 text-orange-400' :
                                                    mov.estado === 'Activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>
                                                {mov.tipo === 'CIERRE' ? <Archive size={20} /> : <UserPlus size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-tight">
                                                    {mov.tipo === 'CIERRE' ? mov.titulo : `${mov.detalle} (${mov.titulo})`}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold italic">
                                                    {mov.fecha} • {mov.tipo === 'CIERRE' ? <span className="text-orange-400">Turno Cerrado</span> : mov.estado}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black px-3 py-1 rounded-lg ${mov.tipo === 'CIERRE' ? 'bg-orange-500 text-white' : 'bg-white/10'}`}>
                                            {mov.cantidad}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <InventoryTable medicamentos={medicamentos} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedicamentosModule;
