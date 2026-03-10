import React from "react";
import { PernoctaDiaItem } from "./PernoctaDiaForm";
import { Trash2, MapPin, Plane } from "lucide-react";

interface Props {
    items: PernoctaDiaItem[];
    onRemove: (index: number) => void;
}

const PernoctaDiaTable: React.FC<Props> = ({ items, onRemove }) => {
    if (!items.length) {
        return (
            <div className="flex flex-col items-center justify-center p-12 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400">
                <Plane size={40} className="opacity-20 mb-4" />
                <p className="text-xs font-black tracking-widest text-center">No hay aeronaves en la lista de espera</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-lg dark:bg-slate-900 dark:border-slate-800">
            <table className="min-w-full">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-slate-400">Aeronave</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-slate-400">Ubicación</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black tracking-widest text-slate-400">Observaciones</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black tracking-widest text-slate-400">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {items.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                                        {item.matricula.substring(0, 2)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200 tracking-wider uppercase">{item.matricula}</p>
                                        <p className="text-[10px] text-slate-400 font-bold tracking-tight italic">{item.nombre}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-rose-500" />
                                    <span className="text-xs font-black text-slate-600 tracking-widest">
                                        {item.ubicacion === "H1" ? "Hangar 1" : "Hangar 2"}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <p className="text-xs font-medium text-slate-500 line-clamp-1 max-w-xs italic">
                                    {item.observaciones || "Sin observaciones específicas"}
                                </p>
                            </td>
                            <td className="px-6 py-5 text-center">
                                <button
                                    onClick={() => onRemove(i)}
                                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                                    title="Quitar"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PernoctaDiaTable;
