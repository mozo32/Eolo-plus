import React from 'react';
import { TABLA_CALIBRACION } from './tablaCalibracion';
import { Clock, Calendar } from 'lucide-react';

interface SeccionCierreProps {
    nombreCierre: string;
    fechaCierre: string;
    cmCierre: number | null;
    litrosCierre: number | null;
    totalizadorCierre: number | null;
    onUpdate: (key: string, val: any) => void;
}

const formatNumberWithCommas = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-US').format(value);
};

export const SeccionCierre = ({
    nombreCierre,
    fechaCierre,
    cmCierre,
    litrosCierre,
    totalizadorCierre,
    onUpdate
}: SeccionCierreProps) => {
    const handleTimeInput = (val: string) => {
        const digits = val.replace(/\D/g, '');
        let formatted = digits;

        if (digits.length >= 3) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
        }

        let [hours, minutes] = formatted.split(':');
        if (hours && parseInt(hours) > 23) hours = '23';
        if (minutes && parseInt(minutes) > 59) minutes = '59';

        const finalTime = minutes !== undefined ? `${hours}:${minutes}` : hours;
        const datePart = fechaCierre.split('T')[0] || new Date().toISOString().split('T')[0];

        onUpdate('fechaCierre', `${datePart}T${finalTime.slice(0, 5)}`);
    };

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
            <div>
                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-1">
                    Cronología de Cierre
                </label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 group focus-within:border-blue-300 transition-all shadow-sm">
                    <div className="flex items-center gap-2 flex-1 px-2">
                        <Calendar size={16} className="text-blue-500" />
                        <input
                            type="date"
                            value={fechaCierre ? fechaCierre.split('T')[0] : ''}
                            onChange={(e) => {
                                const time = fechaCierre.split('T')[1] || '00:00';
                                onUpdate('fechaCierre', `${e.target.value}T${time}`);
                            }}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full cursor-pointer"
                        />
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200"></div>

                    <div className="flex items-center gap-2 flex-1 px-2">
                        <Clock size={16} className="text-blue-500" />
                        <input
                            type="text"
                            placeholder="HH:MM"
                            maxLength={5}
                            value={fechaCierre ? fechaCierre.split('T')[1]?.substring(0, 5) : ''}
                            onChange={(e) => handleTimeInput(e.target.value)}
                            className="bg-transparent text-sm font-mono font-bold text-slate-700 outline-none w-full placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>
            <br />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase">
                        Lectura Totalizador Final (Auto)
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberWithCommas(totalizadorCierre)}
                        readOnly
                        className="w-full border-b-2 border-gray-100 bg-gray-50 text-blue-700 outline-none py-1 font-mono text-lg cursor-not-allowed"
                        placeholder="Calculado..."
                    />
                    <p className="text-[10px] text-gray-400 mt-1">* Suma de Inicio + Ventas</p>
                </div>
            </div>
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
                            type="text"
                            inputMode="numeric"
                            value={formatNumberWithCommas(litrosCierre)}
                            readOnly
                            className="w-full border-b-2 border-gray-100 bg-gray-50 text-blue-600 outline-none py-1 font-mono text-lg pr-8 cursor-not-allowed"
                            placeholder="Litros"
                        />
                        <span className="absolute right-0 bottom-1 text-[10px] text-blue-400 font-bold">LTS</span>
                    </div>
                </div>
            </div>
        </section>
    );
};
