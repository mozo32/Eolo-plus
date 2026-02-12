import React from 'react';
import { Fuel, AlertTriangle, Milestone } from 'lucide-react';

interface Props {
    datos: { km: string; combustible: string };
    onChange: (nuevosDatos: any) => void;
}

export const SeccionVehiculo = ({ datos, onChange }: Props) => {
    const nivel = Number(datos.combustible);
    const rotation = (nivel * 1.8) - 90;

    const getStatusColor = () => {
        if (nivel <= 15) return 'text-red-500';
        if (nivel <= 40) return 'text-amber-500';
        return 'text-green-500';
    };

    // Formatear el kilometraje con separador de miles ficticio para realismo visual
    const formattedKm = datos.km.padStart(6, '0').slice(-6);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Milestone size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Lectura de Odómetro</h3>
                        <p className="text-[10px] text-gray-400 uppercase font-medium">Ingrese el kilometraje actual</p>
                    </div>
                </div>

                <div className="relative group">
                    <input
                        type="number"
                        placeholder="000000"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-5 px-6 text-4xl font-mono text-gray-800 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        value={datos.km}
                        onChange={(e) => onChange({ ...datos, km: e.target.value })}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl italic select-none">
                        KM
                    </div>
                </div>
            </div>

            {/* INDICADOR DE COMBUSTIBLE ANALÓGICO (MANTENIDO) */}
            <div className="bg-[#f8fafc] p-8 rounded-[40px] shadow-inner border border-white flex flex-col items-center">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-10 flex items-center gap-2">
                    <Fuel size={14} /> Fuel Gauge System
                </h3>

                <div className="relative w-72 h-40">
                    <svg viewBox="0 0 200 110" className="w-full">
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 20 100 A 80 80 0 0 1 41 47" fill="none" stroke="#ef4444" strokeWidth="11" strokeDasharray="2, 4" />
                        {[0, 25, 50, 75, 100].map(p => {
                            const angle = (p * 1.8) - 180;
                            const x1 = 100 + 75 * Math.cos((angle * Math.PI) / 180);
                            const y1 = 100 + 75 * Math.sin((angle * Math.PI) / 180);
                            const x2 = 100 + 87 * Math.cos((angle * Math.PI) / 180);
                            const y2 = 100 + 87 * Math.sin((angle * Math.PI) / 180);
                            return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="2" />;
                        })}
                        <text x="15" y="110" fontSize="8" fontWeight="bold" fill="#ef4444">E</text>
                        <text x="175" y="110" fontSize="8" fontWeight="bold" fill="#64748b">F</text>
                    </svg>

                    <div
                        className="absolute bottom-0 left-1/2 w-1 h-32 bg-red-600 origin-bottom rounded-full transition-transform duration-1000 ease-out shadow-lg"
                        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                    >
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-800 rounded-full border-4 border-slate-700 shadow-md"></div>
                    </div>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                    <div className={`text-4xl font-black italic tracking-tighter ${getStatusColor()}`}>
                        {nivel}%
                    </div>
                    {nivel <= 15 && (
                        <div className="flex items-center gap-1 text-red-500 animate-bounce mt-1">
                            <AlertTriangle size={12} />
                            <span className="text-[10px] font-bold uppercase">Advertencia de combustible bajo</span>
                        </div>
                    )}
                </div>

                <input
                    type="range"
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-10 accent-slate-800"
                    value={datos.combustible}
                    onChange={(e) => onChange({ ...datos, combustible: e.target.value })}
                />
            </div>

            <div className="flex gap-2">
                {[0, 50, 100].map((v) => (
                    <button
                        key={v}
                        onClick={() => onChange({ ...datos, combustible: v.toString() })}
                        className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                        SET {v}%
                    </button>
                ))}
            </div>
        </div>
    );
};
