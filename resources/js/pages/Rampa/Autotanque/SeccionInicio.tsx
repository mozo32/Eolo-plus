import React from 'react';
import { TABLA_CALIBRACION } from './tablaCalibracion';
import { Calendar, Clock } from 'lucide-react';

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

    const handleCmChange = (cm: number) => {
        onUpdate('cmIni', cm);
        if (TABLA_CALIBRACION[cm] !== undefined) {
            onUpdate('litrosIni', TABLA_CALIBRACION[cm]);
        }
    };
    const handleTimeInput = (val: string) => {
        const digits = val.replace(/\D/g, '');
        let formatted = digits;

        if (digits.length >= 3) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
        }
        let [hours, minutes] = formatted.split(':');
        if (hours && parseInt(hours) > 23) hours = '23';
        if (minutes && parseInt(minutes) > 59) minutes = '59';

        const finalValue = minutes !== undefined ? `${hours}:${minutes}` : hours;
        const date = fecha.split('T')[0] || new Date().toISOString().split('T')[0];
        onUpdate('fecha', `${date}T${finalValue.slice(0, 5)}`);
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Cronología de Turno</label>
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 group focus-within:border-blue-300 transition-all shadow-sm">
                        <div className="flex items-center gap-2 flex-1 px-2">
                            <Calendar size={16} className="text-blue-500" />
                            <input
                                type="date"
                                value={fecha ? fecha.split('T')[0] : ''}
                                onChange={(e) => {
                                    const time = fecha.split('T')[1] || '00:00';
                                    onUpdate('fecha', `${e.target.value}T${time}`);
                                }}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full cursor-pointer"
                            />
                        </div>

                        <div className="h-6 w-[1px] bg-slate-200"></div>

                        {/* HORA (ESCRIBIBLE) */}
                        <div className="flex items-center gap-2 flex-1 px-2">
                            <Clock size={16} className="text-blue-500" />
                            <input
                                type="text"
                                placeholder="HH:MM"
                                maxLength={5}
                                value={fecha ? fecha.split('T')[1]?.substring(0, 5) : ''}
                                onChange={(e) => handleTimeInput(e.target.value)}
                                className="bg-transparent text-sm font-mono font-bold text-slate-700 outline-none w-full placeholder:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                        <p className="text-[9px] text-slate-400 font-medium uppercase">Día / Mes / Año</p>
                        <p className="text-[9px] text-slate-400 font-medium uppercase">Formato 24h</p>
                    </div>
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
