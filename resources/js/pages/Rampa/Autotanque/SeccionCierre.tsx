import React from 'react';
import { TABLA_CALIBRACION } from './tablaCalibracion';

interface SeccionCierreProps {
    nombreCierre: string; // Nombre de quien recibe
    fechaCierre: string;
    cmCierre: number | null;
    litrosCierre: number | null;
    totalizadorCierre: number | null;
    onUpdate: (key: string, val: any) => void;
}

export const SeccionCierre = ({
    nombreCierre,
    fechaCierre,
    cmCierre,
    litrosCierre,
    totalizadorCierre,
    onUpdate
}: SeccionCierreProps) => {

    const handleCmChange = (cm: number) => {
        onUpdate('cmCierre', cm);
        if (TABLA_CALIBRACION[cm] !== undefined) {
            onUpdate('litrosCierre', TABLA_CALIBRACION[cm]);
        }
    };

    return (
        <section className="pt-6 border-t-2 border-dashed border-gray-200">
            <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1 uppercase">
                Datos al Cierre de Turno
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fila 1: Identificación de Cierre */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Nombre recibe</label>
                    <input
                        type="text"
                        value={nombreCierre}
                        onChange={(e) => onUpdate('nombreCierre', e.target.value)}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1"
                        placeholder="Nombre de quien recibe"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Fecha y Hora de Cierre</label>
                    <input
                        type="datetime-local"
                        value={fechaCierre}
                        onChange={(e) => onUpdate('fechaCierre', e.target.value)}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1"
                    />
                </div>

                {/* Fila 2: Toma Física de Cierre */}
                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Toma Física Final
                    </label>
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={cmCierre || ''}
                                onChange={(e) => handleCmChange(Number(e.target.value))}
                                className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 font-mono text-lg pr-8"
                                placeholder="CM"
                            />
                            <span className="absolute right-0 bottom-1 text-[10px] text-gray-400 font-bold">CM</span>
                        </div>
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={litrosCierre || ''}
                                readOnly
                                className="w-full border-b-2 border-gray-100 bg-gray-50 text-blue-600 outline-none py-1 font-mono text-lg pr-8 cursor-not-allowed"
                                placeholder="Litros"
                            />
                            <span className="absolute right-0 bottom-1 text-[10px] text-blue-400 font-bold">LTS</span>
                        </div>
                    </div>
                </div>

                {/* Fila 3: Totalizador */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">
                        Lectura Totalizador Final
                    </label>
                    <input
                        type="number"
                        value={totalizadorCierre || ''}
                        onChange={(e) => onUpdate('totalizadorCierre', Number(e.target.value))}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 font-mono text-lg"
                        placeholder="000000"
                    />
                </div>
            </div>
        </section>
    );
};
