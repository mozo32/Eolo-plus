import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, X, Check } from 'lucide-react';
import { fetchRemisionesDelDia } from '@/stores/apiAutoTanque';

interface BuscadorProps {
    onSelect: (remision: any) => void;
    onClose: () => void;
    foliosExistentes: string[];
}

export const BuscadorRemisiones = ({ onSelect, onClose, foliosExistentes }: BuscadorProps) => {
    const hoy = new Date().toISOString().split('T')[0];

    const [filterType, setFilterType] = useState<'day' | 'range' | 'month' | 'year'>('day');
    const [fechaBusqueda, setFechaBusqueda] = useState(hoy);
    const [startDate, setStartDate] = useState(hoy);
    const [endDate, setEndDate] = useState(hoy);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState<any[]>([]);
    const [cargando, setCargando] = useState(false);
    const [foliosSeleccionados, setFoliosSeleccionados] = useState<string[]>(foliosExistentes);

    const buscar = async () => {
        setCargando(true);
        try {
            let params: any = { type: filterType };

            if (filterType === 'day') params.date = fechaBusqueda;
            if (filterType === 'range') { params.start = startDate; params.end = endDate; }
            if (filterType === 'month') { params.month = selectedMonth; params.year = selectedYear; }
            if (filterType === 'year') params.year = selectedYear;

            const res = await fetchRemisionesDelDia({
                params,
                page: 1,
                per_page: 100,
            });

            setResultados(res.data || res);
        } catch (error) {
            console.error("Error buscando remisiones:", error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        buscar();
    }, [filterType, fechaBusqueda, startDate, endDate, selectedMonth, selectedYear]);

    const filtrados = resultados.filter(r =>
        (r.folio || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (r.cliente || '').toLowerCase().includes(busqueda.toLowerCase())
    );

    const handleInternalSelect = (item: any) => {
        setFoliosSeleccionados(prev => [...prev, item.folio]);
        onSelect(item);
    };

    return (
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Search size={20} className="text-blue-600" /> Buscar Remisión
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="pl-4 pr-8 py-2 rounded-xl border-none bg-white text-xs font-black uppercase tracking-wider shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="day">Día</option>
                        <option value="range">Rango</option>
                        <option value="month">Mes</option>
                        <option value="year">Año</option>
                    </select>

                    <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>

                    <div className="flex flex-1 items-center gap-2">
                        {filterType === 'day' && (
                            <input
                                type="date"
                                value={fechaBusqueda}
                                onChange={(e) => setFechaBusqueda(e.target.value)}
                                className="flex-1 min-w-[150px] px-3 py-1.5 text-sm rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                            />
                        )}

                        {filterType === 'range' && (
                            <div className="flex items-center gap-2 flex-1">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-slate-400 text-xs font-bold">a</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {filterType === 'month' && (
                            <div className="flex gap-2 flex-1">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="w-full px-3 py-1.5 text-sm rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                                >
                                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                                        <option key={m} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="w-24 px-3 py-1.5 text-sm rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {filterType === 'year' && (
                            <input
                                type="number"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="flex-1 px-3 py-1.5 text-sm rounded-lg border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                    </div>
                </div>


            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-xl shadow-inner bg-slate-50/30">
                {cargando ? (
                    <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold uppercase tracking-widest">Consultando...</span>
                    </div>
                ) : filtrados.length > 0 ? (
                    <table className="w-full text-left">
                        <thead className="bg-white sticky top-0 border-b border-slate-100 z-10">
                            <tr>
                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Folio</th>
                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Detalles</th>
                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filtrados.map((item) => {
                                const isSelected = foliosSeleccionados.includes(item.folio);
                                return (
                                    <tr key={item.id || item.folio} className={`transition-colors ${isSelected ? 'bg-green-50/50' : 'hover:bg-blue-50/50'}`}>
                                        <td className="p-3 font-mono font-bold text-sm text-slate-700">{item.folio || `#${item.id}`}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600">{item.cliente}</span>
                                                <span className="text-[10px] text-slate-400">{item.litros?.toLocaleString()} Lts</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => !isSelected && handleInternalSelect(item)}
                                                disabled={isSelected}
                                                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 ml-auto transition-all ${
                                                    isSelected
                                                        ? 'text-green-600 bg-green-100 cursor-default'
                                                        : 'text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white'
                                                }`}
                                            >
                                                {isSelected ? <><Check size={14} /> Añadido</> : <><CheckCircle size={14} /> Seleccionar</>}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-10 text-center text-slate-400 text-sm font-medium">
                        No se encontraron remisiones para los criterios seleccionados.
                    </div>
                )}
            </div>
        </div>
    );
};
