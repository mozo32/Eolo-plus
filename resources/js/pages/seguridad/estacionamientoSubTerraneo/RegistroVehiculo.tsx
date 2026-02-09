import React, { useState } from 'react';
import { Check, X, LogIn, LogOut, Clock, Plus, Search } from 'lucide-react';

const RegistroVehiculo = () => {
    // Estado que simula la transición entre rondas
    const [vehiculos, setVehiculos] = useState([
        { id: 1, placas: 'ABC-123', vehiculo: 'Sedan', color: 'Gris', estado: 'presente', rondasHoy: 2, ultimaRonda: '10:00' },
        { id: 2, placas: 'XYZ-987', vehiculo: 'SUV', color: 'Negro', estado: 'pendiente', rondasHoy: 1, ultimaRonda: '08:00' },
        { id: 3, placas: 'MEX-456', vehiculo: 'Pickup', color: 'Blanco', estado: 'ausente', rondasHoy: 0, ultimaRonda: 'Ayer' },
    ]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* Header Dinámico */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Pase de Lista</h1>
                        <p className="text-slate-400 text-sm">Ronda Actual: <span className="text-blue-400 font-bold">#3 - 13:00 hrs</span></p>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                        <Plus size={20} /> NUEVO INGRESO
                    </button>
                </div>

                {/* Buscador de acción rápida */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                        placeholder="Escriba placa para registrar o confirmar..."
                    />
                </div>

                {/* Lista de Auditoría */}
                <div className="space-y-4">
                    {vehiculos.map((v) => (
                        <div
                            key={v.id}
                            className={`group relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${v.estado === 'presente' ? 'border-emerald-500/50 bg-emerald-500/5' :
                                    v.estado === 'ausente' ? 'border-red-500/30 bg-red-500/5 opacity-50' :
                                        'border-slate-700 bg-slate-800/50'
                                }`}
                        >
                            <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">

                                {/* Info Principal */}
                                <div className="flex items-center gap-6 w-full md:w-auto">
                                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${v.estado === 'presente' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
                                        }`}>
                                        {v.placas.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-mono font-black tracking-widest">{v.placas}</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase">{v.vehiculo} • {v.color}</p>
                                    </div>
                                </div>

                                {/* Status de Rondas */}
                                <div className="flex gap-4 items-center">
                                    <div className="text-center px-4 border-x border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Rondas Hoy</p>
                                        <p className="text-xl font-black text-blue-400">{v.rondasHoy}</p>
                                    </div>
                                    <div className="hidden md:block">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Último Avistamiento</p>
                                        <p className="text-sm font-semibold text-slate-300">{v.ultimaRonda}</p>
                                    </div>
                                </div>

                                {/* Botones de Acción (Lógica de Entrada/Salida) */}
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-colors">
                                        <LogOut size={18} /> SALIÓ
                                    </button>
                                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all scale-105 shadow-xl shadow-blue-500/20">
                                        <Check size={18} /> SIGUE AQUÍ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Resumen de la Ronda */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase">Total en Sótano</p>
                        <p className="text-2xl font-black">45</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase">Confirmados</p>
                        <p className="text-2xl font-black text-emerald-400">12</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase">Pendientes</p>
                        <p className="text-2xl font-black text-amber-400">33</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-xs font-bold text-slate-500 uppercase">Salidas Hoy</p>
                        <p className="text-2xl font-black text-red-400">08</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistroVehiculo;
