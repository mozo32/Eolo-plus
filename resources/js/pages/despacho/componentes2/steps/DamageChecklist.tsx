import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, MousePointer2, Eye, ShieldCheck, AlertCircle, Box } from 'lucide-react';
import MapaDanios3D, { PuntoDanio, MapaDanios3DRef } from '../../components/walkAround/MapaDanios3D';
import EvidenciFotografica from '../../components/walkAround/EvidenciFotografica';

export const DAMAGE_TYPES = [
    { key: "sin_danio", label: "Sin daño" },
    { key: "golpe", label: "Golpe" },
    { key: "rayon", label: "Rayón" },
    { key: "fisurado", label: "Fisurado" },
    { key: "quebrado", label: "Quebrado" },
    { key: "pintura_cuarteada", label: "Pint. cuarteada" },
    { key: "otro", label: "Otro" },
];

export const SECTIONS_PLANE = [
    { key: "A", label: "Sección A", items: ["Tren de nariz", "Compuertas tren de aterrizaje", "Parabrisas / limpiadores", "Radomo", "Tubo Pitot"] },
    { key: "B", label: "Sección B", items: ["Fuselaje", "Antena"] },
    { key: "C", label: "Sección C", items: ["Aleta", "Aleron", "Compensador de aleron", "Mechas de descarga estatica", "Punta de ala", "Luces de carreteo / aterrizaje", "Luces de navegación, beacon", "Borde de ataque", "Tren de aterrizaje principal", "Válvulas de servicio (combustible, etc...)"] },
    { key: "D", label: "Sección D", items: ["Motor"] },
    { key: "E", label: "Sección E", items: ["Estabilizador vertical", "Timón de dirección", "Compensador timón de dirección", "Estabilizador horizontal", "Timón de profundidad", "Compensador timón de profundidad", "Borde de empenaje", "Alas delta"] },
];

export const ITEMS_HELICOPTER = [
    "Fuselaje", "Puertas, ventanas, antenas, luces", "Esquí / Neumáticos", "Palas", "Boom", "Estabilizadores", "Rotor de cola", "Parabrisas"
];

interface Props {
    aeronaveType: 'avion' | 'helicoptero';
    inspeccion: any;
    setInspeccion: React.Dispatch<React.SetStateAction<any>>;
    isMapOpen: boolean;
    setIsMapOpen: (val: boolean) => void;
}

const VehicleInspection = ({ aeronaveType, inspeccion, setInspeccion }: Props) => {
    const [activeSection, setActiveSection] = useState("A");
    const mapaRef = useRef<MapaDanios3DRef>(null);
    const fotos = inspeccion.fotos || [];

    const currentItems = aeronaveType === 'avion'
        ? SECTIONS_PLANE.find(s => s.key === activeSection)?.items || []
        : ITEMS_HELICOPTER;

    const modelPath = aeronaveType === 'avion' ? '/models/Avion.obj' : '/models/18706 Fighter Helicopter_v1.obj';
    const puntos3D = inspeccion.puntos3D || [];

    // --- HANDLERS ---
    const handleFotosChange = (nuevasFotos: any[]) => {
        setInspeccion((prev: any) => ({ ...prev, fotos: nuevasFotos }));
    };

    const handleToggle = (part: string, field: string) => {
        setInspeccion((prev: any) => {
            const currentPart = prev[part] || { izq: false, der: false, damages: [] };

            if (field === 'izq' || field === 'der') {
                return { ...prev, [part]: { ...currentPart, [field]: !currentPart[field] } };
            } else {
                const isSinDanio = field === 'sin_danio';
                let newDamages = [...currentPart.damages];
                let newIzq = currentPart.izq;
                let newDer = currentPart.der;

                if (isSinDanio) {
                    const markingClean = !newDamages.includes('sin_danio');
                    if (markingClean) {
                        newDamages = ['sin_danio'];
                        newIzq = false;
                        newDer = false;
                    } else {
                        newDamages = [];
                    }
                } else {
                    newDamages = newDamages.filter(d => d !== 'sin_danio');
                    newDamages = newDamages.includes(field)
                        ? newDamages.filter(d => d !== field)
                        : [...newDamages, field];
                }

                return { ...prev, [part]: { izq: newIzq, der: newDer, damages: newDamages } };
            }
        });
    };

    const handleMarkAllClean = () => {
        setInspeccion((prev: any) => {
            const newState = { ...prev };
            currentItems.forEach(item => {
                newState[item] = { izq: false, der: false, damages: ['sin_danio'] };
            });
            return newState;
        });
    };

    const handleEstaticasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInspeccion((prev: any) => ({ ...prev, numeroEstaticas: value }));
    };

    return (
        <div className="w-full bg-slate-50 min-h-screen">
            <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row-reverse gap-0 lg:h-screen overflow-hidden">
                <div className="w-full lg:w-1/2 xl:w-5/12 p-4 md:p-6 lg:h-full overflow-y-auto border-l border-slate-200 bg-slate-50/50">
                    <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                        <EvidenciFotografica
                            value={fotos}
                            onChange={handleFotosChange}
                        />
                    </div>
                </div>

                <div className="w-full lg:w-1/2 xl:w-7/12 flex flex-col bg-white lg:h-full shadow-[20px_0_30px_-15px_rgba(0,0,0,0.05)] z-10">
                    {aeronaveType === 'avion' && (
                        <div className="flex gap-2 p-4 bg-white border-b border-slate-100 overflow-x-auto sticky top-0 z-20 no-scrollbar">
                            {SECTIONS_PLANE.map(section => (
                                <button
                                    type='button'
                                    key={section.key}
                                    onClick={() => setActiveSection(section.key)}
                                    className={`px-6 py-3 rounded-2xl font-black text-[11px] transition-all whitespace-nowrap shadow-sm border ${activeSection === section.key
                                            ? 'bg-slate-900 text-white border-slate-900 scale-105'
                                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                                        }`}
                                >
                                    {section.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                    Inspección: {aeronaveType === 'avion' ? `Sección ${activeSection}` : 'Helicóptero'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md">
                                        {currentItems.length} Componentes
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-end gap-3 w-full md:w-auto">
                                <div className="flex flex-col gap-1.5 flex-1 md:flex-none">
                                    <label className="text-[10px] font-black text-indigo-600 tracking-widest ml-1 flex items-center gap-1">
                                        N° Estáticas <span className="text-rose-500 text-sm">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={inspeccion.numeroEstaticas || ''}
                                        onChange={handleEstaticasChange}
                                        className={`bg-slate-50 border-2 rounded-xl px-4 py-2 font-bold text-slate-700 focus:ring-4 outline-none transition-all w-full md:w-28 ${!inspeccion.numeroEstaticas
                                                ? 'border-amber-200 bg-amber-50/20'
                                                : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
                                            }`}
                                    />
                                </div>
                                <button
                                    type='button'
                                    onClick={handleMarkAllClean}
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-lg shadow-emerald-100 h-[44px]"
                                >
                                    <ShieldCheck size={16} /> Sección OK
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 pb-10">
                            {currentItems.map((item) => {
                                const partData = inspeccion[item] || { izq: false, der: false, damages: [] };
                                const damagesList = partData.damages || [];
                                const isClean = damagesList.includes('sin_danio');
                                const hasDamages = damagesList.length > 0 && !isClean;

                                return (
                                    <div
                                        key={item}
                                        className={`p-5 rounded-3xl border-2 transition-all duration-300 ${hasDamages ? 'border-amber-200 bg-amber-50/40 shadow-md' :
                                                isClean ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100 bg-white'
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full shadow-sm ${hasDamages ? 'bg-amber-500 animate-pulse' :
                                                        isClean ? 'bg-emerald-500' : 'bg-slate-200'
                                                    }`} />
                                                <span className="font-black text-slate-700 text-sm tracking-tight">
                                                    {item}
                                                </span>
                                            </div>

                                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit shadow-inner">
                                                <button
                                                    type='button'
                                                    onClick={() => handleToggle(item, 'izq')}
                                                    className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${partData.izq ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'
                                                        }`}
                                                > IZQ </button>
                                                <button
                                                    type='button'
                                                    onClick={() => handleToggle(item, 'der')}
                                                    className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${partData.der ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'
                                                        }`}
                                                > DER </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                            {DAMAGE_TYPES.map(d => (
                                                <button
                                                    type='button'
                                                    key={d.key}
                                                    onClick={() => handleToggle(item, d.key)}
                                                    className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all ${
                                                        damagesList.includes(d.key) // <--- Aquí usamos la lista protegida
                                                        ? (d.key === 'sin_danio' ? 'bg-emerald-600 ...' : 'bg-amber-500 ...')
                                                        : 'bg-white ...'
                                                    }`}
                                                >
                                                    {d.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleInspection;
