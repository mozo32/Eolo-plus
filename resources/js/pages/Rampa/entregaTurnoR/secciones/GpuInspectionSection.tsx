import React from 'react';
import { BatteryCharging, Clock, Hash, MessageSquare, Zap, Settings2 } from 'lucide-react';

interface GpuProps {
    data: any;
    onChange: (gpuKey: string, field: string, value: string) => void;
}

const GpuInspectionSection: React.FC<GpuProps> = ({ data, onChange }) => {
    const gpuKeys = Object.keys(data);

    return (
        <div className="space-y-6">
            <div className="items-center justify-between ml-2">
                <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1 ">
                    Inspección de GPUs
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gpuKeys.map((key, index) => {
                    const gpu = data[key];
                    const isSystemCritical = gpu.enchufe === 'Mal' || gpu.llantas === 'Mal' || gpu.cableado === 'Mal';
                    const isLastAndOdd = index === gpuKeys.length - 1 && gpuKeys.length % 2 !== 0;
                    const isGpu115 = key === 'gpu115';
                    const isPlantBased = key === 'hobart600' || key === 'foxtronics';

                    return (
                        <div
                            key={key}
                            className={`bg-white border-2 rounded-[2.5rem] p-5 transition-all duration-300 relative overflow-hidden ${
                                isLastAndOdd ? 'md:col-span-2' : ''
                            } ${
                                isSystemCritical
                                ? 'border-red-200 shadow-xl shadow-red-50'
                                : 'border-slate-100 shadow-sm hover:shadow-md'
                            }`}
                        >
                            {/* Cabecera */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-2xl ${isSystemCritical ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
                                        <BatteryCharging size={22} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter leading-none">{key}</h3>
                                        <p className="text-[10px] font-bold text-slate-400  tracking-[0.2em] mt-1">Ground Power Unit</p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400  tracking-widest">¿Limpia?</span>
                                    <div className="flex p-1 bg-slate-100 rounded-xl">
                                        {['Si', 'No'].map(opt => (
                                            <button
                                                key={opt}
                                                type='button'
                                                onClick={() => onChange(key, 'limpia', opt)}
                                                className={`px-4 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                    gpu.limpia === opt
                                                    ? (opt === 'No' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                                                    : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 ml-2">
                                            {isPlantBased ? 'Nº Plantas' : 'Horómetro'}
                                        </label>
                                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-blue-400 transition-all">
                                            {isPlantBased ? <Hash size={16} className="text-purple-500" /> : <Clock size={16} className="text-blue-500" />}
                                            <input
                                                type="number"
                                                value={isPlantBased ? gpu.numPlantas : gpu.horometro}
                                                onChange={(e) => onChange(key, isPlantBased ? 'numPlantas' : 'horometro', e.target.value)}
                                                className="bg-transparent w-full outline-none font-black text-slate-700"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    {isGpu115 && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 ml-2">Cableado</label>
                                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                {['Bien', 'Mal'].map(opt => (
                                                    <button
                                                        key={opt}
                                                        type='button'
                                                        onClick={() => onChange(key, 'cableado', opt)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                            gpu.cableado === opt
                                                            ? (opt === 'Mal' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white')
                                                            : 'text-slate-400'
                                                        }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 rounded-[2rem] p-4 flex flex-col justify-around border border-slate-100">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[9px] font-bold text-slate-500">Enchufe</span>
                                            <span className={`w-2 h-2 rounded-full ${gpu.enchufe === 'Bien' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                        </div>
                                        <div className="flex bg-white p-1 rounded-xl shadow-sm">
                                            {['Bien', 'Mal'].map(opt => (
                                                <button
                                                    key={opt}
                                                    type='button'
                                                    onClick={() => onChange(key, 'enchufe', opt)}
                                                    className={`flex-1 py-1 rounded-lg text-[9px] font-black transition-all ${
                                                        gpu.enchufe === opt
                                                        ? (opt === 'Mal' ? 'bg-red-500 text-white' : 'bg-slate-900 text-white')
                                                        : 'text-slate-300'
                                                    }`}
                                                >
                                                    {opt.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 mt-2">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[9px] font-bold text-slate-500">Llantas</span>
                                            <span className={`w-2 h-2 rounded-full ${gpu.llantas === 'Bien' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                        </div>
                                        <div className="flex bg-white p-1 rounded-xl shadow-sm">
                                            {['Bien', 'Mal'].map(opt => (
                                                <button
                                                    key={opt}
                                                    type='button'
                                                    onClick={() => onChange(key, 'llantas', opt)}
                                                    className={`flex-1 py-1 rounded-lg text-[9px] font-black transition-all ${
                                                        gpu.llantas === opt
                                                        ? (opt === 'Mal' ? 'bg-red-500 text-white' : 'bg-slate-900 text-white')
                                                        : 'text-slate-300'
                                                    }`}
                                                >
                                                    {opt.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <MessageSquare size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={gpu.obs}
                                    onChange={(e) => onChange(key, 'obs', e.target.value)}
                                    placeholder="Añadir nota técnica o reporte de fallas..."
                                    className="w-full bg-slate-100/50 border border-transparent rounded-2xl py-3 pl-12 pr-4 text-xs font-medium text-slate-600 outline-none focus:bg-white focus:border-blue-200 focus:shadow-inner transition-all"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GpuInspectionSection;
