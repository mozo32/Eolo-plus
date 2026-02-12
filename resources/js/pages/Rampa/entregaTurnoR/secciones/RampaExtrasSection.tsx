import React from 'react';
import { Plane, Zap, MapPin, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ExtrasProps {
    carrito: any;
    aeronaves: Record<string, number | string>;
    onChangeCarrito: (id: string, field: string, value: string) => void;
    onChangeAeronaves: (field: string, value: string) => void;
}

const RampaExtrasSection: React.FC<ExtrasProps> = ({ carrito, aeronaves, onChangeCarrito, onChangeAeronaves }) => {
    const totalAeronaves = Object.values(aeronaves).reduce((acc: number, curr: any) => {
        return acc + (Number(curr) || 0);
    }, 0);

    return (
        <div className="space-y-8">
            <div className="bg-blue-50/50 border-2 border-blue-100 rounded-[2.5rem] p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600 border border-blue-100">
                            <Plane size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Inventario de Aeronaves</h3>
                            <p className="text-blue-500 text-[10px] font-bold tracking-widest uppercase">Distribución actual en plataforma</p>
                        </div>
                    </div>
                    <div className="bg-blue-600 self-start md:self-center px-6 py-2 rounded-2xl text-white shadow-lg shadow-blue-200">
                        <span className="text-[10px] font-black uppercase opacity-80 block leading-none mb-1">Total Flota</span>
                        <span className="text-xl font-black leading-none">
                            {totalAeronaves}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.keys(aeronaves).map((loc) => (
                        <div key={loc} className="bg-white border border-blue-100 p-5 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-400">
                                    <MapPin size={14} />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    {loc.replace('_', ' ')}
                                </span>
                            </div>
                            <input
                                type="number"
                                value={aeronaves[loc]}
                                onChange={(e) => onChangeAeronaves(loc, e.target.value)}
                                className="w-full bg-slate-50 rounded-xl py-3 px-4 text-3xl font-black text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-200 transition-all text-center"
                            />
                        </div>
                    ))}
                </div>
            </div>
            {Object.keys(carrito).map((id) => (
                <div key={id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-2 shadow-sm mb-6">
                    <div className="flex flex-col lg:flex-row gap-2">
                        <div className="bg-slate-50 rounded-[2rem] p-8 lg:w-72 flex flex-col justify-between border border-slate-100">
                            <div>
                                <div className="bg-amber-100 text-amber-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                    <Zap size={24} fill="currentColor" />
                                </div>
                                <h4 className="text-3xl font-black text-slate-800 tracking-tighter italic">GOLF-{id}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-[0.2em]">Inspección diaria</p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel de Batería</span>
                                    <span className={`text-2xl font-black transition-colors ${Number(carrito[id].carga) < 20 ? 'text-red-500 animate-pulse' : 'text-amber-500'
                                        }`}>
                                        {carrito[id].carga}%
                                    </span>
                                </div>
                                <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden mb-4">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${Number(carrito[id].carga) < 20 ? 'bg-red-500' : 'bg-amber-400'
                                            }`}
                                        style={{ width: `${carrito[id].carga}%` }}
                                    />
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={carrito[id].carga || 0}
                                    onChange={(e) => onChangeCarrito(id, 'carga', e.target.value)}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all"
                                />

                                <div className="flex justify-between mt-2 px-1">
                                    <span className="text-[8px] font-bold text-slate-400">0%</span>
                                    <span className="text-[8px] font-bold text-slate-400">50%</span>
                                    <span className="text-[8px] font-bold text-slate-400">100%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-6 space-y-8">
                            {/* Grid de estados de inspección */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {['llantas', 'luces', 'frenos', 'limpieza'].map((item) => {
                                    // Lógica para determinar si el estado es positivo o negativo
                                    // Para limpieza: 'Limpio' es positivo, 'Sucio' es negativo
                                    const isGood = item === 'limpieza'
                                        ? carrito[id][item] === 'Limpio'
                                        : carrito[id][item] === 'Bien';

                                    return (
                                        <button
                                            key={item}
                                            type='button'
                                            onClick={() => {
                                                const nextValue = item === 'limpieza'
                                                    ? (carrito[id][item] === 'Limpio' ? 'Sucio' : 'Limpio')
                                                    : (carrito[id][item] === 'Bien' ? 'Mal' : 'Bien');
                                                onChangeCarrito(id, item, nextValue);
                                            }}
                                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isGood
                                                    ? 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200'
                                                    : 'bg-red-50 border-red-100 text-red-600 shadow-inner'
                                                }`}
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="text-[9px] font-black uppercase opacity-60">{item}</span>
                                                <span className="font-bold uppercase tracking-tight">
                                                    {carrito[id][item]}
                                                </span>
                                            </div>
                                            {isGood ? (
                                                <CheckCircle2 size={20} className="text-emerald-500" />
                                            ) : (
                                                <AlertTriangle size={20} className="text-red-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Notas de Mantenimiento */}
                            <div className="bg-slate-50 rounded-[1.5rem] p-4 border border-slate-100">
                                <div className="flex items-center gap-2 mb-3 text-slate-400">
                                    <MessageSquare size={16} />
                                    <span className="text-[10px] font-black uppercase">Notas de Mantenimiento</span>
                                </div>
                                <textarea
                                    value={carrito[id].obs}
                                    onChange={(e) => onChangeCarrito(id, 'obs', e.target.value)}
                                    placeholder="Sin observaciones adicionales..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 h-20 resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RampaExtrasSection;
