import React, { useEffect, useMemo, useState } from 'react';
import { Search, Archive, CalendarDays, RotateCcw } from 'lucide-react';
import { Medicamento } from './types';

interface Props {
    medicamentos: Medicamento[];
    cierres: any[];
    onBuscarCierres: (params?: any) => void;
}

const InventoryTable: React.FC<Props> = ({ medicamentos, cierres, onBuscarCierres }) => {
    const [filtro, setFiltro] = useState('');
    const [fechaCierre, setFechaCierre] = useState('');
    const [cierreSeleccionadoId, setCierreSeleccionadoId] = useState('');

    const formatearFecha = (valor?: string | null) => {
        if (!valor) return '';

        const texto = String(valor);
        const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }

        const fecha = new Date(texto);

        if (Number.isNaN(fecha.getTime())) {
            return texto;
        }

        return fecha.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    useEffect(() => {
        if (cierres.length > 0 && !cierreSeleccionadoId) {
            setCierreSeleccionadoId(String(cierres[0].id));
        }

        if (cierres.length === 0) {
            setCierreSeleccionadoId('');
        }
    }, [cierres]);

    const cierreSeleccionado = useMemo(() => {
        return cierres.find((c) => String(c.id) === String(cierreSeleccionadoId)) || null;
    }, [cierres, cierreSeleccionadoId]);

    const filas = useMemo(() => {
        if (cierreSeleccionado) {
            return Object.entries(cierreSeleccionado.medicamentos || {}).map(([nombre, data]: any) => {
                const inicio = Number(data.inicio) || 0;
                const final = Number(data.final) || 0;

                return {
                    id: nombre,
                    nombre,
                    inicio,
                    entregados: inicio - final,
                    stock: final,
                };
            });
        }

        return medicamentos.map((m) => {
            const entregados = Number(m.total_entregado) || 0;
            const stockInicial = Number(m.cantidad) + entregados;

            return {
                id: m.id,
                nombre: m.nombre,
                inicio: stockInicial,
                entregados,
                stock: Number(m.cantidad) || 0,
            };
        });
    }, [medicamentos, cierreSeleccionado]);

    const filasFiltradas = filas.filter((m) =>
        m.nombre.toLowerCase().includes(filtro.toLowerCase())
    );

    const buscarPorFecha = () => {
        if (!fechaCierre) {
            onBuscarCierres();
            setCierreSeleccionadoId('');
            return;
        }

        setCierreSeleccionadoId('');
        onBuscarCierres({
            fecha: fechaCierre,
        });
    };

    const limpiarConsulta = () => {
        setFechaCierre('');
        setCierreSeleccionadoId('');
        onBuscarCierres();
    };

    return (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-5">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-black uppercase tracking-tighter text-slate-600 flex items-center gap-2">
                            <Archive size={18} />
                            {cierreSeleccionado ? 'Inventario del Cierre' : 'Inventario Actual'}
                        </h3>

                        {cierreSeleccionado && (
                            <p className="text-xs text-slate-500 font-bold mt-1">
                                Responsable: {cierreSeleccionado.responsable} | Fecha: {formatearFecha(cierreSeleccionado.fecha)}
                            </p>
                        )}
                    </div>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filtrar medicamento..."
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="bg-white border border-slate-200 rounded-full py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-blue-400 w-full md:w-64"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                            Fecha de cierre
                        </label>
                        <input
                            type="date"
                            value={fechaCierre}
                            onChange={(e) => setFechaCierre(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-bold outline-none focus:border-blue-400"
                        />
                    </div>

                    <div className="md:col-span-1 flex items-end">
                        <button
                            type="button"
                            onClick={buscarPorFecha}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-2.5 px-4 text-xs font-black uppercase flex items-center justify-center gap-2"
                        >
                            <CalendarDays size={16} />
                            Consultar
                        </button>
                    </div>

                    <div className="md:col-span-1 flex items-end">
                        <button
                            type="button"
                            onClick={limpiarConsulta}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl py-2.5 px-4 text-xs font-black uppercase flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={16} />
                            Actual
                        </button>
                    </div>

                    <div className="md:col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                            Cierres encontrados
                        </label>
                        <select
                            value={cierreSeleccionadoId}
                            onChange={(e) => setCierreSeleccionadoId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-bold outline-none focus:border-blue-400"
                        >
                            <option value="">Inventario actual</option>
                            {cierres.map((cierre) => (
                                <option key={cierre.id} value={cierre.id}>
                                    {formatearFecha(cierre.fecha)} - {cierre.responsable}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Medicamento</th>
                            <th className="px-6 py-4">Inicio</th>
                            <th className="px-6 py-4">Entregados</th>
                            <th className="px-6 py-4">
                                {cierreSeleccionado ? 'Final del Cierre' : 'Stock Actual'}
                            </th>
                            <th className="px-6 py-4">Estatus</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-50">
                        {filasFiltradas.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-xs font-black uppercase">
                                    Sin registros
                                </td>
                            </tr>
                        )}

                        {filasFiltradas.map((m) => (
                            <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700 text-sm uppercase">
                                    {m.nombre}
                                </td>

                                <td className="px-6 py-4 font-bold text-slate-400">
                                    {m.inicio}
                                </td>

                                <td className="px-6 py-4 font-bold text-red-500 text-sm">
                                    -{m.entregados}
                                </td>

                                <td className="px-6 py-4 font-black text-slate-800 text-md">
                                    {m.stock}
                                </td>

                                <td className="px-6 py-4">
                                    <span
                                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                            m.stock === 0
                                                ? 'bg-red-100 text-red-600'
                                                : m.stock <= 5
                                                    ? 'bg-orange-100 text-orange-600'
                                                    : 'bg-emerald-100 text-emerald-600'
                                        }`}
                                    >
                                        {m.stock === 0 ? 'Agotado' : m.stock <= 5 ? 'Reabastecer' : 'Disponible'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-slate-50 text-center">
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:underline">
                    Ver reporte detallado
                </button>
            </div>
        </div>
    );
};

export default InventoryTable;
