import { Plus, Trash2 } from 'lucide-react';

interface TablaProps {
    remisiones: any[];
    total: number;
    onAdd: () => void;
    onDelete: (index: number) => void;
}

export const TablaRemisiones = ({ remisiones, total, onAdd, onDelete }: TablaProps) => (
    <section className="bg-slate-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-blue-800 font-bold uppercase">Remisiones Entregadas</h2>
            <button
                type="button"
                onClick={onAdd}
                className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1 hover:bg-blue-700 transition"
            >
                <Plus size={16} /> Agregar Folio
            </button>
        </div>
        <table className="w-full text-left">
            <thead>
                <tr className="text-xs text-gray-400 uppercase">
                    <th className="pb-2"># Folio</th>
                    <th className="pb-2">Litros</th>
                    <th className="pb-2 text-center">Estado</th>
                    <th className="pb-2"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {remisiones.map((rem, idx) => (
                    <tr key={idx} className={rem.isCancelled ? "bg-red-50" : ""}>
                        <td className="py-2 font-mono">{rem.folio}</td>
                        <td className="py-2 font-mono">{`${rem.litros} Lts`}</td>
                        <td className="py-2 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${rem.isCancelled ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                                {rem.isCancelled ? 'CANCELADA' : 'ACTIVA'}
                            </span>
                        </td>
                        <td className="py-2 text-right text-gray-400">
                            {!rem.isCancelled && (
                                <Trash2
                                    size={16}
                                    className="cursor-pointer hover:text-red-500 transition-colors"
                                    onClick={() => onDelete(idx)}
                                />
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="mt-4 pt-4 border-t border-gray-300 text-right">
            <span className="text-gray-500 text-sm mr-4">Suma total vendidos:</span>
            <span className="text-xl font-bold text-blue-900">{total} LTS</span>
        </div>
    </section>
);
