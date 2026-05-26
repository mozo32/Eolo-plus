import React from 'react';
import { Truck, Gauge, ClipboardList, CheckCircle2, Settings2, Droplet, Disc, Lightbulb, CircleDot, Milestone } from 'lucide-react';

interface SuministroAgua {
    matricula: string;
    cantidad: string;
}
interface VehiculoData {
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
    estado?: 'Operativo' | 'Mantenimiento' | '';
    kilometraje?: string;
    suministros?: SuministroAgua[];
}

interface Props {
    vehiculos: Record<string, VehiculoData>;
    onChange: (id: string, field: keyof VehiculoData, value: string) => void;
}

const FuelGauge: React.FC<{ value: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
    const numericValue = parseInt(value) || 0;
    const rotation = (numericValue * 1.8) - 90;

    return (
        <div className="flex flex-col items-center space-y-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm w-full">
            <div className="relative w-64 h-32 flex items-end justify-center overflow-hidden">
                <svg className="absolute bottom-0 w-56 h-28" viewBox="0 0 100 50">
                    <path
                        d="M 10,50 A 40,40 0 0 1 90,50"
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    {[...Array(11)].map((_, i) => {
                        const angle = (i * 18) * (Math.PI / 180);
                        const x1 = 50 - Math.cos(angle) * 35;
                        const y1 = 50 - Math.sin(angle) * 35;
                        const x2 = 50 - Math.cos(angle) * 45;
                        const y2 = 50 - Math.sin(angle) * 45;
                        return (
                            <line
                                key={i}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={i < 3 && numericValue < 20 ? "#ef4444" : "#cbd5e1"}
                                strokeWidth="1"
                            />
                        );
                    })}
                    <path
                        d="M 10,50 A 40,40 0 0 1 90,50"
                        fill="none"
                        stroke={numericValue < 15 ? "#ef4444" : "#3b82f6"}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 - (numericValue * 1.256)}
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>

                <div
                    className="absolute bottom-0 left-1/2 w-1 h-24 bg-red-500 origin-bottom transition-transform duration-1000 ease-out z-10 rounded-full"
                    style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                >
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-full" />
                </div>
                <div className="absolute bottom-[-12px] left-1/2 w-10 h-10 bg-slate-800 rounded-full -translate-x-1/2 z-20 border-4 border-white shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full" />
                </div>
                <div className="absolute bottom-2 left-6 text-xs font-black text-slate-400">E</div>
                <div className="absolute bottom-2 right-6 text-xs font-black text-slate-400">F</div>
            </div>
            <div className="w-full max-w-xs space-y-3 pt-2">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={numericValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-center">
                    <div className={`px-4 py-1 rounded-full text-sm font-black border transition-colors ${numericValue < 15
                        ? 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                        : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                        {numericValue}%
                    </div>
                </div>
            </div>
        </div>
    );
};

const VehiculosSection: React.FC<Props> = ({ vehiculos, onChange }) => {
    const optionsBienMal = ["Bien", "Mal"];
    const optionsLimpieza = ["Limpio", "Sucio"];

    return (
        <div className="space-y-8">
            <header className="bg-blue-900 text-white p-6 rounded-t-lg flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-widest">CONTROL DE FLOTA</h1>
                    <p className="text-sm opacity-80">ESTADO TÉCNICO Y OPERATIVO DE UNIDADES</p>
                </div>
                <Truck size={40} />
            </header>
            <style>
                {`
                    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .animate-spin-slow { animation: spin-slow 3s linear infinite; }
                    input[type='range']::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 18px;
                        height: 18px;
                        background: #2563eb;
                        cursor: pointer;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    }
                `}
            </style>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                {Object.entries(vehiculos).map(([id, data]) => {
                    const isMantenimiento = data.estado === 'Mantenimiento';
                    const isNissan = id.toLowerCase().includes('nissan');

                    return (
                        <div key={id} className={`group relative overflow-hidden rounded-3xl border-2 transition-all duration-500 ${isMantenimiento ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white hover:border-blue-200 shadow-sm'}`}>
                            <div className={`h-1.5 w-full ${isMantenimiento ? 'bg-red-500' : 'bg-blue-600'}`} />
                            <div className="p-4 md:p-6">
                                <div className="flex justify-between items-center gap-2 mb-6">
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-md ${isMantenimiento ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>Unidad</span>
                                        <h3 className={`text-xl md:text-2xl font-black mt-0.5 truncate ${isMantenimiento ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {id.toUpperCase().replace(/([A-ZÁÉÍÓÚÑ]+)([0-9]+)/g, '$1 $2')}
                                        </h3>
                                    </div>
                                    <div className="flex shrink-0 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                                        <button type='button' onClick={() => onChange(id, 'estado', 'Operativo')} className={`p-1.5 md:p-2 rounded-lg transition-all ${!isMantenimiento ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 opacity-50'}`}><CheckCircle2 size={18} /></button>
                                        <button type='button' onClick={() => onChange(id, 'estado', 'Mantenimiento')} className={`p-1.5 md:p-2 rounded-lg transition-all ${isMantenimiento ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 opacity-50'}`}><Settings2 size={18} /></button>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-2 gap-y-6 gap-x-4 transition-opacity duration-300 ${isMantenimiento ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Droplet size={12} /> Limpieza</label>
                                        <select value={data.limpieza} onChange={(e) => onChange(id, 'limpieza', e.target.value)} className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm outline-none">
                                            <option value="">--</option>
                                            {optionsLimpieza.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Disc size={12} /> Llantas</label>
                                        <select value={data.llantas} onChange={(e) => onChange(id, 'llantas', e.target.value)} className={`w-full p-2.5 border-none rounded-xl text-sm font-bold outline-none ${data.llantas === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}>
                                            <option value="">--</option>
                                            {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    {isNissan && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Milestone size={12} /> Kilometraje</label>
                                            <input
                                                type="number"
                                                value={data.kilometraje || ''}
                                                onChange={(e) => onChange(id, 'kilometraje', e.target.value)}
                                                placeholder="0"
                                                className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    )}

                                    {'frenos' in data && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><CircleDot size={12} /> Frenos</label>
                                            <select value={data.frenos || ''} onChange={(e) => onChange(id, 'frenos', e.target.value)} className={`w-full p-2.5 border-none rounded-xl text-sm font-bold outline-none ${data.frenos === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}>
                                                <option value="">--</option>
                                                {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {'luces' in data && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Lightbulb size={12} /> Luces</label>
                                            <select value={data.luces} onChange={(e) => onChange(id, 'luces', e.target.value)} className={`w-full p-2.5 border-none rounded-xl text-sm font-bold outline-none ${data.luces === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}>
                                                <option value="">--</option>
                                                {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {isNissan ? (
                                        <div className="col-span-2 space-y-2 pt-2">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Gauge size={12} /> Combustible</label>
                                            <FuelGauge value={data.nivel || "0"} onChange={(val) => onChange(id, 'nivel', val)} />
                                        </div>
                                    ) : (
                                        'nivel' in data && (
                                            <div className="space-y-1">
                                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><Gauge size={12} /> Nivel de carga</label>
                                                <input type="text" value={data.nivel} onChange={(e) => onChange(id, 'nivel', e.target.value)} className="w-full p-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej. 1/2" />
                                            </div>
                                        )
                                    )}

                                    <div className="col-span-2 space-y-1 pt-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1"><ClipboardList size={12} /> Observaciones</label>
                                        <textarea rows={2} value={data.obs} placeholder="Detalles adicionales..." onChange={(e) => onChange(id, 'obs', e.target.value)} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-none" />
                                    </div>
                                </div>
                                {id === 'aguaPotable' && (
                                    <div className="col-span-2 mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 mb-3 uppercase tracking-wider">
                                            <Droplet size={14} /> Registro de Suministro de Agua
                                        </label>

                                        <div className="space-y-3">
                                            {/* 1. Usamos una constante para asegurar el array y evitar errores de iterador */}
                                            {(() => {
                                                const listaSuministros = data.suministros || [];
                                                return listaSuministros.map((s, index) => (
                                                    <div key={index} className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Matrícula"
                                                            className="flex-1 p-2 text-xs font-bold rounded-lg border-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
                                                            value={s.matricula}
                                                            onChange={(e) => {
                                                                // 2. Clonamos la lista asegurada
                                                                const newS = [...listaSuministros];
                                                                newS[index] = { ...newS[index], matricula: e.target.value.toUpperCase() };
                                                                onChange(id, 'suministros' as any, newS as any);
                                                            }}
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Cant. (Lts)"
                                                            className="w-24 p-2 text-xs font-bold rounded-lg border-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
                                                            value={s.cantidad}
                                                            onChange={(e) => {
                                                                const newS = [...listaSuministros];
                                                                newS[index] = { ...newS[index], cantidad: e.target.value };
                                                                onChange(id, 'suministros' as any, newS as any);
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newS = listaSuministros.filter((_, i) => i !== index);
                                                                onChange(id, 'suministros' as any, newS as any);
                                                            }}
                                                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ));
                                            })()}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const actuales = data.suministros || [];
                                                    const newS = [...actuales, { matricula: '', cantidad: '' }];
                                                    onChange(id, 'suministros' as any, newS as any);
                                                }}
                                                className="w-full py-2 border-2 border-dashed border-blue-200 text-blue-500 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all uppercase tracking-tight"
                                            >
                                                + Agregar Matrícula
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {isMantenimiento && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/10 pointer-events-none">
                                        <div className="bg-red-600 text-white px-4 py-1.5 rounded-full shadow-lg font-black text-[10px] md:text-xs tracking-widest flex items-center gap-2 transform -rotate-3">
                                            <Settings2 size={14} className="animate-spin-slow" /> FUERA DE SERVICIO
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VehiculosSection;
