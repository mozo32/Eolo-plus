import React from 'react';

export interface EquipoOficinaItem {
    equipo: string;
    existencia: number;
    entregadas: number | '';
    recibidas: number;
}

export type EquipoOficinaState = EquipoOficinaItem[];

export const EQUIPOS_OFICINA_DEFAULT: EquipoOficinaState = [
    { equipo: 'Engrapadoras', existencia: 1, entregadas: 1, recibidas: 0 },
    { equipo: 'Perforadoras', existencia: 2, entregadas: 2, recibidas: 0 },
];

interface EquipoOficinaProps {
    value: EquipoOficinaState;
    onChange: (next: EquipoOficinaState) => void;
}

const EquipoOficina: React.FC<EquipoOficinaProps> = ({ value, onChange }) => {

    const handleEntregadasChange = (index: number, raw: string) => {
        const next: EquipoOficinaState = value.map((item, i) => {
            if (i !== index) return item;

            if (raw === '') {
                return {
                    ...item,
                    entregadas: '' as '',
                    recibidas: item.existencia,
                };
            }

            const entregadas = Math.min(
                Math.max(Number(raw), 0),
                item.existencia
            );

            return {
                ...item,
                entregadas,
                recibidas: item.existencia - entregadas,
            };
        });

        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 text-left">Equipo</th>
                            <th className="px-3 py-2 text-center">Existencia</th>
                            <th className="px-3 py-2 text-center">Entregadas</th>
                            <th className="px-3 py-2 text-center">Recibidas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {value.map((item, index) => (
                            <tr key={item.equipo}>
                                <td className="px-3 py-2">{item.equipo}</td>

                                <td className="px-3 py-2 text-center">
                                    {item.existencia}
                                </td>

                                <td className="px-3 py-2 text-center">
                                    <input
                                        type="number"
                                        min={0}
                                        max={item.existencia}
                                        value={item.entregadas}
                                        onChange={(e) =>
                                            handleEntregadasChange(
                                                index,
                                                e.target.value
                                            )
                                        }
                                        className="w-20 rounded border px-2 py-1 text-center"
                                    />
                                </td>

                                <td className="px-3 py-2 text-center">
                                    <input
                                        type="number"
                                        value={item.recibidas}
                                        readOnly
                                        className="w-20 rounded border bg-gray-100 px-2 py-1 text-center"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EquipoOficina;
