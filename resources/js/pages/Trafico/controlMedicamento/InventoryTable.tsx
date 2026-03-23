import React from 'react';
import { Search, Archive } from 'lucide-react';
import { Medicamento } from './types';

interface Props {
    medicamentos: Medicamento[];
}

const InventoryTable: React.FC<Props> = ({ medicamentos }) => {
    return (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black uppercase tracking-tighter text-slate-600 flex items-center gap-2">
                    <Archive size={18} /> Inventario Actual
                </h3>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Filtrar..." className="bg-white border border-slate-200 rounded-full py-1.5 pl-9 pr-4 text-xs font-bold outline-none focus:border-blue-400 w-40 md:w-64" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Medicamento</th>
                            <th className="px-6 py-4">Inicio (Estimado)</th>
                            <th className="px-6 py-4">Entregados</th>
                            <th className="px-6 py-4">Stock Actual</th>
                            <th className="px-6 py-4">Estatus</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {medicamentos.map((m) => {
                            // Cálculo simple: Lo que tengo + lo que ya entregué
                            const entregados = Number(m.total_entregado) || 0;
                            const stockInicial = m.cantidad + entregados;

                            return (
                                <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700 text-sm uppercase">
                                        {m.nombre}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-400">
                                        {stockInicial}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-red-500 text-sm">
                                        -{entregados}
                                    </td>
                                    <td className="px-6 py-4 font-black text-slate-800 text-md">
                                        {m.cantidad}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                            m.cantidad === 0
                                                ? 'bg-red-100 text-red-600'
                                                : m.cantidad <= 5
                                                ? 'bg-orange-100 text-orange-600'
                                                : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            {m.cantidad === 0 ? 'Agotado' : m.cantidad <= 5 ? 'Reabastecer' : 'Disponible'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
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
