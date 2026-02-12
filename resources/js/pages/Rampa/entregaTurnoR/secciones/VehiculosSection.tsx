import React from 'react';
import { Truck, Gauge, ClipboardList } from 'lucide-react';

interface VehiculoData {
    limpieza: string;
    nivel?: string;
    llantas: string;
    frenos?: string;
    obs: string;
    luces?: string;
}

interface Props {
    vehiculos: Record<string, VehiculoData>;
    onChange: (id: string, field: keyof VehiculoData, value: string) => void;
}

const VehiculosSection: React.FC<Props> = ({ vehiculos, onChange }) => {
    const optionsBienMal = ["Bien", "Mal"];
    const optionsLimpieza = ["Limpio", "Sucio"];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4 text-orange-600 border-b pb-2">
                <Truck size={24} />
                <h2 className="font-bold uppercase tracking-wider text-lg">Inspección de Vehículos</h2>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {Object.entries(vehiculos).map(([id, data]) => (
                    <div key={id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-blue-700 font-bold flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                {id.toUpperCase()}
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Limpieza - CORREGIDO con opción vacía */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Limpieza</label>
                                <select
                                    value={data.limpieza}
                                    onChange={(e) => onChange(id, 'limpieza', e.target.value)}
                                    className="w-full mt-1 p-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="">Seleccione...</option>
                                    {optionsLimpieza.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* Llantas - CORREGIDO con opción vacía */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Llantas</label>
                                <select
                                    value={data.llantas}
                                    onChange={(e) => onChange(id, 'llantas', e.target.value)}
                                    className={`w-full mt-1 p-2 border rounded text-sm outline-none ${data.llantas === 'Mal' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-300'}`}
                                >
                                    <option value="">Seleccione...</option>
                                    {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* Nivel (Si existe) */}
                            {'nivel' in data && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Nivel / Combustible</label>
                                    <div className="relative mt-1">
                                        <input
                                            type="text"
                                            value={data.nivel}
                                            onChange={(e) => onChange(id, 'nivel', e.target.value)}
                                            className="w-full p-2 pl-8 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                        <Gauge className="absolute left-2 top-2.5 text-gray-400" size={14} />
                                    </div>
                                </div>
                            )}

                            {/* Frenos (Si existe) - CORREGIDO */}
                            {'frenos' in data && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Frenos</label>
                                    <select
                                        value={data.frenos}
                                        onChange={(e) => onChange(id, 'frenos', e.target.value)}
                                        className={`w-full mt-1 p-2 border rounded text-sm outline-none ${data.frenos === 'Mal' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-300'}`}
                                    >
                                        <option value="">Seleccione...</option>
                                        {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Luces (Si existe) - CORREGIDO */}
                            {'luces' in data && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase">Luces</label>
                                    <select
                                        value={data.luces}
                                        onChange={(e) => onChange(id, 'luces', e.target.value)}
                                        className={`w-full mt-1 p-2 border rounded text-sm outline-none ${data.luces === 'Mal' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-300'}`}
                                    >
                                        <option value="">Seleccione...</option>
                                        {optionsBienMal.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Observaciones */}
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase">Observaciones</label>
                                <div className="relative mt-1">
                                    <input
                                        type="text"
                                        value={data.obs}
                                        placeholder="Detalles adicionales..."
                                        onChange={(e) => onChange(id, 'obs', e.target.value)}
                                        className="w-full p-2 pl-8 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                    <ClipboardList className="absolute left-2 top-2.5 text-gray-400" size={14} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VehiculosSection;
