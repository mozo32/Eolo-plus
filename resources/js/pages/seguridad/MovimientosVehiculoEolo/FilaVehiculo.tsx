import { useState } from 'react';
import { Vehiculo } from './types';
import { Car, ArrowUpRight, ArrowDownLeft, History, X } from 'lucide-react';
import { HistorialVehiculo } from './HistorialVehiculo';

interface Props {
    vehiculo: Vehiculo;
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
}

export const FilaVehiculo = ({ vehiculo, onAccion }: Props) => {
    const [showHistory, setShowHistory] = useState(false);

    return (
        <>
            <tr className="border-t border-gray-100 hover:bg-gray-50 transition-all">
                <td className="p-4 font-medium text-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                            <Car size={18} />
                        </div>
                        <span className="font-bold">{vehiculo.nombre}</span>
                    </div>
                </td>
                <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        vehiculo.estado === 'En Planta' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                        {vehiculo.estado}
                    </span>
                </td>
                <td className="p-4 text-sm text-gray-500 font-mono">{vehiculo.ultimaActividad}</td>

                <td className="p-4">
                    <div className="flex justify-center gap-2">
                        {/* Botón de Historial */}
                        <button
                            onClick={() => setShowHistory(true)}
                            className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Ver Historial"
                        >
                            <History size={18} />
                        </button>

                        <button
                            onClick={() => onAccion(vehiculo, 'Salida')}
                            disabled={vehiculo.estado === 'En Ruta'}
                            className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-30 transition-all shadow-sm"
                        >
                            <ArrowUpRight size={18} />
                        </button>

                        <button
                            onClick={() => onAccion(vehiculo, 'Entrada')}
                            disabled={vehiculo.estado === 'En Planta'}
                            className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white disabled:opacity-30 transition-all shadow-sm"
                        >
                            <ArrowDownLeft size={18} />
                        </button>
                    </div>
                </td>
            </tr>
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-2">
                                <History className="text-indigo-600" size={20} />
                                <h3 className="font-bold text-gray-800">Historial Completo: {vehiculo.nombre}</h3>
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 bg-white">
                            <HistorialVehiculo vehiculoId={vehiculo.id} />
                        </div>

                        <div className="p-4 border-t bg-gray-50 text-right">
                            <button
                                onClick={() => setShowHistory(false)}
                                className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition-colors"
                            >
                                Cerrar Bitácora
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
