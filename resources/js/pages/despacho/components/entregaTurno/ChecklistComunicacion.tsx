import React from 'react';

export type EstadoCargado = 'si' | 'no' | '';

export interface ItemComunicacionEstado {
    entregado: boolean;
    cargado: EstadoCargado;
}

export type ChecklistComunicacionState = {
    items: Record<string, ItemComunicacionEstado>;
    fallas: string;
};

export const EQUIPOS_COMUNICACION = [
    { equipo: 'CELULAR ZTE', cantidad: 1 },
    { equipo: 'RADIO MOTOROLA', cantidad: 2 },
    { equipo: 'RADIO VHF PORTATIL', cantidad: 2 },
    { equipo: 'RADIO VHF FIJO', cantidad: 2 },
];

interface ChecklistComunicacionProps {
    value: ChecklistComunicacionState;
    onChange: (next: ChecklistComunicacionState) => void;
}

const ChecklistComunicacion: React.FC<ChecklistComunicacionProps> = ({ value, onChange }) => {
    const { items, fallas } = value;

    const toggleEntregado = (equipo: string) => {
        const prev = items[equipo] ?? { entregado: false, cargado: '' };

        onChange({
            ...value,
            items: {
                ...items,
                [equipo]: { ...prev, entregado: !prev.entregado },
            },
        });
    };

    const setCargado = (equipo: string, cargado: EstadoCargado) => {
        const prev = items[equipo] ?? { entregado: false, cargado: '' };

        onChange({
            ...value,
            items: {
                ...items,
                [equipo]: { ...prev, cargado },
            },
        });
    };

    const handleFallas = (texto: string) => {
        onChange({
            ...value,
            fallas: texto,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Checklist de comunicación
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Verifique que todo el equipo esté entregado y registrado como cargado.
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="min-w-full border-collapse text-xs md:text-sm">
                    <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">Equipo</th>
                            <th className="px-3 py-2 text-center font-medium">Cantidad</th>
                            <th className="px-3 py-2 text-center font-medium">Entregado</th>
                            <th className="px-3 py-2 text-center font-medium">Cargado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {EQUIPOS_COMUNICACION.map(({ equipo, cantidad }, idx) => {
                            const item = items[equipo] ?? { entregado: false, cargado: '' };

                            return (
                                <tr
                                    key={equipo}
                                    className={`border-t border-gray-200 dark:border-gray-700 ${
                                        idx % 2 === 0
                                            ? 'bg-white dark:bg-gray-900'
                                            : 'bg-gray-50 dark:bg-gray-950/40'
                                    }`}
                                >
                                    <td className="px-3 py-2 align-middle text-gray-800 dark:text-gray-100">
                                        {equipo}
                                    </td>
                                    <td className="px-3 py-2 text-center align-middle text-gray-700 dark:text-gray-200">
                                        {cantidad}
                                    </td>
                                    <td className="px-3 py-2 text-center align-middle">
                                        <label className="inline-flex items-center gap-1 text-xs text-gray-800 dark:text-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={item.entregado}
                                                onChange={() => toggleEntregado(equipo)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                                            />
                                            <span>Entregado</span>
                                        </label>
                                    </td>
                                    <td className="px-3 py-2 text-center align-middle">
                                        <div className="inline-flex items-center gap-3">
                                            <label className="inline-flex items-center gap-1 text-xs text-gray-800 dark:text-gray-100">
                                                <input
                                                    type="radio"
                                                    name={`cargado-${equipo}`}
                                                    value="si"
                                                    checked={item.cargado === 'si'}
                                                    onChange={() => setCargado(equipo, 'si')}
                                                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                                                />
                                                <span>Sí</span>
                                            </label>

                                            <label className="inline-flex items-center gap-1 text-xs text-gray-800 dark:text-gray-100">
                                                <input
                                                    type="radio"
                                                    name={`cargado-${equipo}`}
                                                    value="no"
                                                    checked={item.cargado === 'no'}
                                                    onChange={() => setCargado(equipo, 'no')}
                                                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                                                />
                                                <span>No</span>
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-2">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Fallas en equipo de comunicación
                </label>
                <textarea
                    value={fallas}
                    onChange={(e) => handleFallas(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                        outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Describa las fallas encontradas, si las hay..."
                    rows={3}
                />
            </div>
        </div>
    );
};

export default ChecklistComunicacion;
