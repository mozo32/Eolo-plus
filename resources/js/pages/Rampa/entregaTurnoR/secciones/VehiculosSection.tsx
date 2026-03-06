import React from 'react';
import { Truck, Gauge, ClipboardList, CheckCircle2, Settings2, Droplet, Disc, Lightbulb, CircleDot } from 'lucide-react';

interface VehiculoData {
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
    estado?: 'Operativo' | 'Mantenimiento' | '';
}

interface Props {
    vehiculos: Record<string, VehiculoData>;
    onChange: (id: string, field: keyof VehiculoData, value: string) => void;
}

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
                    @keyframes spin-slow {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .animate-spin-slow {
                        animation: spin-slow 3s linear infinite;
                    }
                `}
            </style>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 space-y-8">
                {Object.entries(vehiculos).map(([id, data]) => {
                    const isMantenimiento = data.estado === 'Mantenimiento';

                    return (
                        <div
                            key={id}
                            className={`group relative overflow-hidden rounded-3xl border-2 transition-all duration-500 ${isMantenimiento
                                ? 'border-red-100 bg-red-50/30'
                                : 'border-gray-100 bg-white hover:border-blue-200 shadow-sm'
                                }`}
                        >
                            <div className={`h-1.5 w-full ${isMantenimiento ? 'bg-red-500' : 'bg-blue-600'}`} />

                            <div className="p-4 md:p-6">
                                <div className="flex justify-between items-center gap-2 mb-6">
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-md ${isMantenimiento ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            Unidad
                                        </span>
                                        <h3 className={`text-xl md:text-2xl font-black mt-0.5 truncate ${isMantenimiento ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {id.toUpperCase()}
                                        </h3>
                                    </div>

                                    <div className="flex shrink-0 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                                        <button
                                            type='button'
                                            onClick={() => onChange(id, 'estado', 'Operativo')}
                                            className={`p-1.5 md:p-2 rounded-lg transition-all ${!isMantenimiento ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 opacity-50'}`}
                                        >
                                            <CheckCircle2 size={18} />
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => onChange(id, 'estado', 'Mantenimiento')}
                                            className={`p-1.5 md:p-2 rounded-lg transition-all ${isMantenimiento ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 opacity-50'}`}
                                        >
                                            <Settings2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-2 gap-y-4 gap-x-3 transition-opacity duration-300 ${isMantenimiento ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400  ml-1">
                                            <Droplet size={12} /> Limpieza
                                        </label>
                                        <select
                                            value={data.limpieza}
                                            onChange={(e) => onChange(id, 'limpieza', e.target.value)}
                                            className="w-full p-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            <option value="">--</option>
                                            {optionsLimpieza.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1">
                                            <Disc size={12} /> Llantas
                                        </label>
                                        <select
                                            value={data.llantas}
                                            onChange={(e) => onChange(id, 'llantas', e.target.value)}
                                            className={`w-full p-2 border-none rounded-xl text-sm font-bold outline-none ${data.llantas === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'
                                                }`}
                                        >
                                            <option value="">--</option>
                                            {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    {'frenos' in data && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1">
                                                <CircleDot size={12} /> Frenos
                                            </label>
                                            <select
                                                value={data.frenos || ''}
                                                onChange={(e) => onChange(id, 'frenos', e.target.value)}
                                                className={`w-full p-2 border-none rounded-xl text-sm font-bold outline-none ${data.frenos === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}
                                            >
                                                <option value="">--</option>
                                                {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {'nivel' in data && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1">
                                                <Gauge size={12} /> Nivel
                                            </label>
                                            <input
                                                type="text"
                                                value={data.nivel}
                                                onChange={(e) => onChange(id, 'nivel', e.target.value)}
                                                className="w-full p-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Ej. 1/2"
                                            />
                                        </div>
                                    )}

                                    {'luces' in data && (
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1">
                                                <Lightbulb size={12} /> Luces
                                            </label>
                                            <select
                                                value={data.luces}
                                                onChange={(e) => onChange(id, 'luces', e.target.value)}
                                                className={`w-full p-2 border-none rounded-xl text-sm font-bold outline-none ${data.luces === 'Mal' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'
                                                    }`}
                                            >
                                                <option value="">--</option>
                                                {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    <div className="col-span-2 space-y-1 pt-1">
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 ml-1">
                                            <ClipboardList size={12} /> Observaciones
                                        </label>
                                        <textarea
                                            rows={1}
                                            value={data.obs}
                                            placeholder={isMantenimiento ? "Motivo..." : "Detalles..."}
                                            onChange={(e) => onChange(id, 'obs', e.target.value)}
                                            className="w-full p-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                                        />
                                    </div>
                                </div>

                                {isMantenimiento && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/10 pointer-events-none">
                                        <div className="bg-red-600 text-white px-4 py-1.5 rounded-full shadow-lg font-black text-[10px] md:text-xs  tracking-widest flex items-center gap-2 transform -rotate-3">
                                            <Settings2 size={14} className="animate-spin-slow" />
                                            En Taller
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
