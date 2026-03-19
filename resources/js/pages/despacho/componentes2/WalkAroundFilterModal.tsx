import React from 'react';
import { X, Calendar, Plane, ArrowUpDown, Filter, RotateCcw } from 'lucide-react';

interface Filters {
    q: string;
    fecha_inicio: string;
    fecha_fin: string;
    movimiento: string;
    tipo: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    onApply: () => void;
}

const WalkAroundFilterModal = ({ open, onClose, filters, setFilters, onApply }: Props) => {
    if (!open) return null;

    const resetFilters = () => {
        setFilters({
            q: '',
            fecha_inicio: '',
            fecha_fin: '',
            movimiento: '',
            tipo: ''
        });
    };

    const setQuickRange = (range: 'today' | 'month') => {
        const today = new Date().toISOString().split('T')[0];
        if (range === 'today') {
            setFilters(prev => ({ ...prev, fecha_inicio: today, fecha_fin: today }));
        } else {
            const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, fecha_inicio: firstDay, fecha_fin: today }));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <Filter size={20} className="text-white" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Filtros Avanzados</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Movimiento</label>
                            <select
                                value={filters.movimiento}
                                onChange={(e) => setFilters(prev => ({ ...prev, movimiento: e.target.value }))}
                                className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-600 outline-none text-sm transition-all"
                            >
                                <option value="">Todos</option>
                                <option value="entrada">Entrada</option>
                                <option value="salida">Salida</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                            <select
                                value={filters.tipo}
                                onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                                className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-600 outline-none text-sm transition-all"
                            >
                                <option value="">Todos</option>
                                <option value="avion">Avión</option>
                                <option value="helicoptero">Helicóptero</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Rango de fechas</label>
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="date"
                                value={filters.fecha_inicio}
                                onChange={(e) => setFilters(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                                className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                            />
                            <input
                                type="date"
                                value={filters.fecha_fin}
                                onChange={(e) => setFilters(prev => ({ ...prev, fecha_fin: e.target.value }))}
                                className="bg-slate-50 border-0 ring-1 ring-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setQuickRange('today')} className="text-[10px] font-bold px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">HOY</button>
                            <button onClick={() => setQuickRange('month')} className="text-[10px] font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">ESTE MES</button>
                        </div>
                    </div>
                </div>
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={resetFilters}
                        className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-white transition-all border border-slate-200"
                    >
                        <RotateCcw size={18} />
                        Limpiar
                    </button>
                    <button
                        onClick={() => { onApply(); onClose(); }}
                        className="flex-[2] bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        Aplicar Filtros
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WalkAroundFilterModal;
