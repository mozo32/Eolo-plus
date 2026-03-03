import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, X, Check } from 'lucide-react';
import { fetchRemisionesDelDia } from '@/stores/apiAutoTanque';

interface BuscadorProps {
    onSelect: (remision: any) => void;
    onClose: () => void;
    foliosExistentes: any;
}

export const BuscadorRemisiones = ({ onSelect, onClose,foliosExistentes }: BuscadorProps) => {
    const obtenerFechaMexico = () => {
        const ahora = new Date();
        const opciones: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Mexico_City',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        };
        return new Intl.DateTimeFormat('sv-SE', opciones).format(ahora).replace(', ', 'T').replace(' ', 'T');
    };
    const [fechaBusqueda, setFechaBusqueda] = useState(obtenerFechaMexico().split('T')[0]);
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState<any[]>([]);
    const [cargando, setCargando] = useState(false);
    const [foliosSeleccionados, setFoliosSeleccionados] = useState<string[]>(foliosExistentes);

    const buscar = async () => {
        setCargando(true);
        try {
            const data = await fetchRemisionesDelDia(fechaBusqueda);
            setResultados(data);
        } catch (error) {
            console.error("Error buscando remisiones:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        buscar();
    }, [fechaBusqueda]);

    const filtrados = resultados.filter(r =>
        r.folio.toLowerCase().includes(busqueda.toLowerCase())
    );
    const handleInternalSelect = (item: any) => {
        setFoliosSeleccionados(prev => [...prev, item.folio]);
        onSelect(item);
    };
    return (
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                    <Search size={20} /> Buscar Remisión
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500">
                    <X size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha de Consulta</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={fechaBusqueda}
                            onChange={(e) => setFechaBusqueda(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Folio</label>
                    <input
                        type="text"
                        placeholder="Ej. A-123..."
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-lg">
                {cargando ? (
                    <div className="p-10 text-center text-gray-500">Cargando remisiones...</div>
                ) : filtrados.length > 0 ? (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-400">FOLIO</th>
                                <th className="p-3 text-xs font-bold text-gray-400">LITROS</th>
                                <th className="p-3 text-xs font-bold text-gray-400">CLIENTE</th>
                                <th className="p-3 text-xs font-bold text-gray-400 text-right">ACCIÓN</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtrados.map((item) => {
                                const isSelected = foliosSeleccionados.includes(item.folio);

                                return (
                                    <tr
                                        key={item.folio}
                                        className={`transition-colors ${isSelected
                                                ? 'bg-green-50 border-l-4 border-l-green-500' // Estilo si ya se seleccionó
                                                : 'hover:bg-blue-50'
                                            }`}
                                    >
                                        <td className="p-3 font-mono font-bold text-sm">{item.folio}</td>
                                        <td className="p-3 text-sm">{Number(item.total_litros).toLocaleString()} Lts</td>
                                        <td className="p-3 text-sm">{item.cliente}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => !isSelected && handleInternalSelect(item)}
                                                disabled={isSelected}
                                                className={`font-bold text-sm flex items-center gap-1 ml-auto transition-all ${isSelected
                                                        ? 'text-green-600 cursor-default'
                                                        : 'text-blue-600 hover:text-blue-800'
                                                    }`}
                                            >
                                                {isSelected ? (
                                                    <><Check size={16} /> Añadido</>
                                                ) : (
                                                    <><CheckCircle size={16} /> Seleccionar</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-10 text-center text-gray-400">No se encontraron remisiones para este día.</div>
                )}
            </div>
        </div>
    );
};
