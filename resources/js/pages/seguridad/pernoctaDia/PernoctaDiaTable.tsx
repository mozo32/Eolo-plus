import React from "react";
import { PernoctaDiaItem } from "./PernoctaDiaForm";

interface Props {
    items: PernoctaDiaItem[];
    onRemove: (index: number) => void;
}

const PernoctaDiaTable: React.FC<Props> = ({ items, onRemove }) => {
    if (!items.length) {
        return (
            <p className="text-sm text-gray-500">
                No hay registros agregados.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Matrícula</th>
                        <th className="px-3 py-2 text-left">Ubicación</th>
                        <th className="px-3 py-2 text-left">Nombre</th>
                        <th className="px-3 py-2 text-left">Observaciones</th>
                        <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                </thead>

                <tbody className="divide-y">
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td className="px-3 py-2 whitespace-nowrap">
                                {item.fecha}
                            </td>
                            <td className="px-3 py-2">{item.matricula}</td>
                            <td className="px-3 py-2">{item.ubicacion}</td>
                            <td className="px-3 py-2">{item.nombre}</td>
                            <td className="px-3 py-2 max-w-sm">
                                <p
                                    className="line-clamp-2 text-gray-700 dark:text-gray-300"
                                    title={item.observaciones}
                                >
                                    {item.observaciones || "-"}
                                </p>
                            </td>
                            <td className="px-3 py-2 text-center">
                                <button
                                    onClick={() => onRemove(i)}
                                    className="text-xs font-semibold text-red-600"
                                >
                                    Quitar
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
