import React from 'react';
import { TABLA_CALIBRACION } from './tablaCalibracion';
;

interface SeccionInicioProps {
    nombre: string;
    fecha: string;
    cmIni: number | null;
    litrosIni: number | null;
    totalizadorIni: number | null;
    onUpdate: (key: string, val: any) => void;
}

export const SeccionInicio = ({
    nombre,
    fecha,
    cmIni,
    litrosIni,
    totalizadorIni,
    onUpdate
}: SeccionInicioProps) => {

    // Función que maneja el cambio en CM y busca los litros
    const handleCmChange = (cm: number) => {
        onUpdate('cmIni', cm);

        // Si el valor existe en la tabla, actualizamos litros automáticamente
        if (TABLA_CALIBRACION[cm] !== undefined) {
            onUpdate('litrosIni', TABLA_CALIBRACION[cm]);
        }
    };

    return (
        <section>
            <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1 uppercase">
                Datos al Inicio de Turno
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Nombre entrega</label>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => onUpdate('nombre', e.target.value)}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Fecha y Hora de Entrega</label>
                    <input
                        type="datetime-local"
                        value={fecha}
                        onChange={(e) => onUpdate('fecha', e.target.value)}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1"
                    />
                </div>

                <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Toma Física Inicio de Turno
                    </label>
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={cmIni || ''}
                                onChange={(e) => handleCmChange(Number(e.target.value))}
                                className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 font-mono text-lg pr-8"
                                placeholder="CM"
                            />
                            <span className="absolute right-0 bottom-1 text-[10px] text-gray-400 font-bold">CM</span>
                        </div>
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                value={litrosIni || ''}
                                readOnly // Lo hacemos de solo lectura para que dependa de los CM
                                className="w-full border-b-2 border-gray-100 bg-gray-50 text-blue-600 outline-none py-1 font-mono text-lg pr-8 cursor-not-allowed"
                                placeholder="Litros"
                            />
                            <span className="absolute right-0 bottom-1 text-[10px] text-blue-400 font-bold">LTS</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Lectura Totalizador Inicio de Turno</label>
                    <input
                        type="number"
                        value={totalizadorIni ?? ''}
                        onChange={(e) => onUpdate('totalizadorIni', Number(e.target.value))}
                        className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 font-mono text-lg"
                    />
                </div>
            </div>
        </section>
    );
};
