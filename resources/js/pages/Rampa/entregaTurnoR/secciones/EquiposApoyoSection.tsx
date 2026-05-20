import React from 'react';
import { Anchor, Settings, Layers, Layout, Gauge, CheckCircle2 } from 'lucide-react';

interface EquiposProps {
    data: any;
    onChange: (field: string, value: string) => void;
}

const EquiposApoyoSection: React.FC<EquiposProps> = ({ data, onChange }) => {

    const StateToggle = ({ field, label, options }: { field: string, label: string, options: string[] }) => (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">{label}</span>
            <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(field, opt)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${data[field] === opt
                            ? (opt === 'Mal' || opt === 'Sucia' ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {opt.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between min-h-[180px]">
                <div className="flex justify-between items-start">
                    <div className="bg-blue-600 p-2.5 rounded-2xl text-white">
                        <Anchor size={20} />
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-blue-600 tracking-tighter bg-blue-50 px-2 py-0.5 rounded-md mb-1">
                            Cantidad Total
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                placeholder="0"
                                className="bg-slate-50 text-3xl font-black text-slate-800 w-20 text-right outline-none p-2 rounded-xl border border-transparent focus:border-blue-300 transition-all"
                                value={data.total}
                                onChange={(e) => onChange("total", e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <h3 className="font-black text-slate-800 text-lg leading-tight mb-3">
                        Barras de<br />Remolque
                    </h3>
                    <div className="flex gap-4">
                        <StateToggle field="limpieza" label="Limpieza" options={["Limpia", "Sucia"]} />
                        <StateToggle field="estado" label="Físico" options={["Bien", "Mal"]} />
                    </div>
                </div>
            </div>

            <div className="col-span-6 lg:col-span-3 bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex flex-col items-center text-center gap-3">
                <Settings className="text-indigo-600" size={24} />
                <h3 className="font-bold text-indigo-900 text-xs tracking-widest">Cabezales</h3>
                <input
                    type="number"
                    className="w-full bg-white/50 border-none rounded-xl py-2 text-center font-black text-indigo-600 outline-none"
                    value={data.cabezales}
                    onChange={(e) => onChange("cabezales", e.target.value)}
                />
                <StateToggle field="cabezalesEstado" label="Estado" options={["Bien", "Mal"]} />
            </div>

            <div className="col-span-6 lg:col-span-3 bg-orange-50 p-6 rounded-[2rem] border border-orange-100 flex flex-col items-center text-center gap-3">
                <Layers className="text-orange-600" size={24} />
                <h3 className="font-bold text-orange-900 text-xs tracking-widest">Escaleras</h3>
                <input
                    type="number"
                    className="w-full bg-white/50 border-none rounded-xl py-2 text-center font-black text-orange-600 outline-none"
                    value={data.escalerasCantidad}
                    onChange={(e) => onChange("escalerasCantidad", e.target.value)}
                />
                <StateToggle field="escalerasEstado" label="Estado" options={["Bien", "Mal"]} />
            </div>

            <div className="col-span-12 bg-white rounded-[2.5rem] p-8 border-2 border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-emerald-100/50 transition-all"></div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex items-start gap-5">
                        <div className="bg-emerald-50 p-4 rounded-3xl">
                            <Layout className="text-emerald-600" size={32} />
                        </div>
                        <div>
                            <h3 className="text-slate-800 font-black text-2xl tracking-tight leading-none">
                                Remolque de Equipaje
                            </h3>
                            <div className="flex items-center gap-2 mt-3 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                                <Gauge size={14} className="text-emerald-500" />
                                <span className="text-slate-500 text-[10px] font-bold  tracking-widest">
                                    Checklist de Seguridad
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-8 lg:gap-12">
                        <div className="space-y-4">
                            <span className="text-slate-400 text-[10px] font-black tracking-[0.2em] flex items-center gap-2 ml-1">
                                <CheckCircle2 size={12} className="text-emerald-500" /> Higiene
                            </span>
                            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                {["Limpia", "Sucia"].map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onChange("hamburgueseraLimpieza", opt)}
                                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black transition-all duration-300 ${data.hamburgueseraLimpieza === opt
                                            ? 'bg-white text-emerald-600 shadow-md shadow-emerald-100 border border-emerald-100'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {opt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <span className="text-slate-400 text-[10px] font-black tracking-[0.2em] flex items-center gap-2 ml-1">
                                <CheckCircle2 size={12} className="text-emerald-500" /> Neumáticos
                            </span>
                            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                {["Bien", "Mal"].map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onChange("hamburgueseraLlantas", opt)}
                                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black transition-all duration-300 ${data.hamburgueseraLlantas === opt
                                            ? (opt === 'Mal'
                                                ? 'bg-red-50 text-red-600 border border-red-100'
                                                : 'bg-white text-emerald-600 shadow-md shadow-emerald-100 border border-emerald-100')
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {opt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default EquiposApoyoSection;
