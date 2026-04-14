import { Plus, Trash2, Fuel, ArrowUpCircle } from 'lucide-react';

interface ElementoTabla {
    folio: string;
    litros: number;
    isCancelled?: boolean;
    tipo: 'VENTA' | 'SUMA'; // Diferenciador
}

interface TablaProps {
    remisiones: any[];
    entradasASA: any[];
    total: number;
    onAdd: () => void;
    onAddSuman: () => void;
    onDeleteVenta: (index: number) => void;
    onDeleteSuma: (index: number) => void;
}

export const TablaRemisiones = ({
    remisiones,
    entradasASA,
    total,
    onAdd,
    onAddSuman,
    onDeleteVenta,
    onDeleteSuma
}: TablaProps) => {

    // Combinamos ambos arreglos para la vista, manteniendo su origen
    const dataUnificada = [
        ...remisiones.map((r, idx) => ({ ...r, tipo: 'VENTA', originalIdx: idx })),
        ...entradasASA.map((e, idx) => ({ folio: e.remision, litros: e.litros, tipo: 'SUMA', originalIdx: idx }))
    ];

    return (
        <section className="bg-slate-50 p-4 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h2 className="text-blue-800 font-bold uppercase">Movimientos del Turno</h2>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onAddSuman}
                        className="bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1 hover:bg-green-700 transition shadow-sm"
                    >
                        <Plus size={16} /> Suman (ASA)
                    </button>
                    <button
                        type="button"
                        onClick={onAdd}
                        className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1 hover:bg-blue-700 transition"
                    >
                        <Plus size={16} /> Agregar Folio
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs text-gray-400 uppercase">
                            <th className="pb-2">Tipo</th>
                            <th className="pb-2"># Folio</th>
                            <th className="pb-2">Litros</th>
                            <th className="pb-2 text-center">Estado</th>
                            {/* <th className="pb-2"></th> */}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {dataUnificada.map((item, idx) => (
                            <tr key={`${item.tipo}-${idx}`} className={item.isCancelled ? "bg-red-50" : ""}>
                                <td className="py-2">
                                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full w-fit ${
                                        item.tipo === 'SUMA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {item.tipo === 'SUMA' ? <ArrowUpCircle size={10}/> : <Fuel size={10}/>}
                                        {item.tipo}
                                    </span>
                                </td>
                                <td className="py-2 font-mono text-sm">{item.folio}</td>
                                <td className={`py-2 font-mono font-bold ${item.tipo === 'SUMA' ? 'text-green-600' : 'text-gray-700'}`}>
                                    {item.tipo === 'SUMA' ? `+${item.litros}` : `${item.litros}`} Lts
                                </td>
                                <td className="py-2 text-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${item.isCancelled ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {item.isCancelled ? 'CANCELADA' : 'REGISTRADA'}
                                    </span>
                                </td>
                                {/* <td className="py-2 text-right text-gray-400">
                                    {!item.isCancelled && (
                                        <Trash2
                                            size={16}
                                            className="cursor-pointer hover:text-red-500 transition-colors inline"
                                            onClick={() => item.tipo === 'VENTA' ? onDeleteVenta(item.originalIdx) : onDeleteSuma(item.originalIdx)}
                                        />
                                    )}
                                </td> */}
                            </tr>
                        ))}
                        {dataUnificada.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-400 italic text-sm">
                                    No hay movimientos registrados en este turno
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-300 flex justify-end gap-8">
                <div className="text-right">
                    <p className="text-gray-500 text-[10px] uppercase">Ventas Netas</p>
                    <p className="text-lg font-bold text-blue-900">{total} LTS</p>
                </div>
            </div>
        </section>
    );
};
