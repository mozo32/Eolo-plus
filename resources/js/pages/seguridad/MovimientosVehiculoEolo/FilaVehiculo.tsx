import { useState } from 'react';
import { Vehiculo } from './types';
import { Car, ArrowUpRight, ArrowDownLeft, ChevronDown } from 'lucide-react';
import { HistorialVehiculo } from './HistorialVehiculo';

interface Props {
    vehiculo: Vehiculo;
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export const FilaVehiculo = ({ vehiculo, onAccion, isExpanded, onToggle }: Props) => {
    return (
        <>
            <tr
                onClick={onToggle}
                className={`border-t border-gray-100 hover:bg-gray-50 transition-all cursor-pointer ${isExpanded ? 'bg-indigo-50/40' : ''}`}
            >
                <td className="p-4 font-medium text-gray-700">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            <Car size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                                {vehiculo.nombre}
                                <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </span>
                        </div>
                    </div>
                </td>
                <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${vehiculo.estado === 'En Planta' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {vehiculo.estado}
                    </span>
                </td>
                <td className="p-4 text-sm text-gray-500 font-mono">{vehiculo.ultimaActividad}</td>

                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                        <button onClick={() => onAccion(vehiculo, 'Salida')} disabled={vehiculo.estado === 'En Ruta'} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-30 transition-all">
                            <ArrowUpRight size={18} />
                        </button>
                        <button onClick={() => onAccion(vehiculo, 'Entrada')} disabled={vehiculo.estado === 'En Planta'} className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white disabled:opacity-30 transition-all">
                            <ArrowDownLeft size={18} />
                        </button>
                    </div>
                </td>
            </tr>

            {isExpanded && (
                <tr>
                    <td colSpan={4} className="p-0 border-b border-gray-200">
                        <HistorialVehiculo vehiculoId={vehiculo.id} />
                    </td>
                </tr>
            )}
        </>
    );
};
