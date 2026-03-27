import React, { useState, useEffect } from 'react';
import { History, MapPin, User, Gauge, Search, ChevronLeft, ChevronRight, Fuel } from 'lucide-react';
import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';

interface Movimiento {
    id: number;
    tipo: 'Salida' | 'Entrada';
    created_at: string;
    chofer: string;
    kilometraje: string;
    destino?: string;
    gasolina: string;
}

export const HistorialVehiculo = ({ vehiculoId }: { vehiculoId: string }) => {
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Entrada' | 'Salida'>('Todos');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [paginaActual, setPaginaActual] = useState(1);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading, setLoading] = useState(true);

    const registrosPorPagina = 5;

    const getGasColor = (nivel: string) => {
        const n = nivel.toLowerCase();
        if (n.includes('reserva') || n.includes('vacío') || n.includes('e')) return 'bg-red-100 text-red-700 border-red-200';
        if (n.includes('1/4') || n.includes('1/2')) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (n.includes('3/4')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (n.includes('lleno') || n.includes('f')) return 'bg-green-100 text-green-700 border-green-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const cargarHistorial = async (filtros?: any) => {
        setLoading(true);
        try {
            const data = await apiVehiculoEolo.getHistorial(vehiculoId, filtros);
            setMovimientos(data);
            setPaginaActual(1);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const filtros = {
            busqueda,
            tipo: filtroTipo,
            fechaInicio,
            fechaFin
        };

        const timer = setTimeout(() => {
            cargarHistorial(filtros);
        }, 400);

        return () => clearTimeout(timer);
    }, [vehiculoId, busqueda, filtroTipo, fechaInicio, fechaFin]);

    const totalPaginas = Math.ceil(movimientos.length / registrosPorPagina);
    const indiceUltimo = paginaActual * registrosPorPagina;
    const indicePrimero = indiceUltimo - registrosPorPagina;
    const movimientosPaginados = movimientos.slice(indicePrimero, indiceUltimo);

    if (loading) {
        return (
            <div className="px-12 py-8 text-center text-gray-400">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
                <p className="text-xs font-medium uppercase tracking-widest">Cargando bitácora...</p>
            </div>
        );
    }

    return (
        <div className="px-12 py-6 bg-gray-50/80 border-y border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                            <History size={16} />
                        </div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Bitácora - {vehiculoId}</h4>
                    </div>
                    <button
                        onClick={() => { setBusqueda(''); setFechaInicio(''); setFechaFin(''); setFiltroTipo('Todos'); setPaginaActual(1); }}
                        className="text-[10px] text-gray-400 hover:text-red-500 font-bold underline transition-colors"
                    >
                        LIMPIAR FILTROS
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                        <input
                            type="text"
                            placeholder="Chofer..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                        <input
                            type="date"
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                        />
                        <span className="text-gray-400 text-xs">-</span>
                        <input
                            type="date"
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                        />
                    </div>
                    <select
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white cursor-pointer"
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value as any)}
                    >
                        <option value="Todos">Todos los tipos</option>
                        <option value="Entrada">Entradas</option>
                        <option value="Salida">Salidas</option>
                    </select>
                </div>
            </div>

            <div className="space-y-3">
                {movimientosPaginados.length > 0 ? (
                    movimientosPaginados.map((m) => (
                        <div key={m.id} className="group flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all">
                            <div className="flex items-center gap-6">
                                <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg font-black text-[10px] shadow-sm ${m.tipo === 'Entrada' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                    {m.tipo === 'Entrada' ? 'ENTRÓ' : 'SALIÓ'}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <User size={14} className="text-gray-400" />
                                        <span className="text-sm font-bold">{m.chofer}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                                        <MapPin size={12} className="text-gray-300" />
                                        <span className="truncate max-w-[200px]">{m.tipo === 'Salida' ? `Destino: ${m.destino}` : 'Regreso a Planta'}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-mono">{m.created_at}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${getGasColor(m.gasolina)}`}>
                                    <Fuel size={12} />
                                    {m.gasolina}
                                </div>
                                <div className="text-right min-w-[80px]">
                                    <div className="flex items-center justify-end gap-1 text-gray-400 mb-0.5">
                                        <Gauge size={12} />
                                        <span className="text-[9px] font-bold uppercase tracking-tighter">Odómetro</span>
                                    </div>
                                    <p className="text-sm font-mono font-black text-gray-700">{m.kilometraje} <span className="text-[10px] text-gray-400">KM</span></p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-400 italic">No se encontraron movimientos con los filtros actuales.</p>
                    </div>
                )}
            </div>

            {totalPaginas > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <p className="text-[11px] text-gray-400 font-medium">
                        Mostrando <span className="text-gray-700 font-bold">{indicePrimero + 1}</span> - <span className="text-gray-700 font-bold">{Math.min(indiceUltimo, movimientos.length)}</span> de <span className="text-gray-700 font-bold">{movimientos.length}</span> registros
                    </p>
                    <div className="flex gap-1.5">
                        <button
                            disabled={paginaActual === 1}
                            onClick={() => setPaginaActual(prev => prev - 1)}
                            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-20 transition-all shadow-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={paginaActual === totalPaginas}
                            onClick={() => setPaginaActual(prev => prev + 1)}
                            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-20 transition-all shadow-sm"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
