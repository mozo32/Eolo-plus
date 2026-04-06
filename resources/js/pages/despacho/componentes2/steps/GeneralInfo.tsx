import React from 'react';
import MatriculaAutocomplete, { AeronaveApiData } from '@/pages/despacho/components/walkAround/MatriculaAutocomplete';
import { ClipboardList } from 'lucide-react';

interface InfoData {
    matricula: string;
    movimiento: 'Entrada' | 'Salida' | '';
    aeronave: 'Avión' | 'Helicóptero' | '';
    tipo: string;
    hora: string;
    destino: string;
    procedencia: string;
    fecha: string;
    bloqueado: boolean;
}

interface Props {
    data: InfoData;
    onChange: (newData: Partial<InfoData>) => void;
}

const GeneralInfo = ({ data, onChange }: Props) => {

    const handleAeronaveData = (aeronave: AeronaveApiData) => {
        let sugerirMovimiento = data.movimiento;
        let debeBloquear = false;
        if (aeronave.movimiento?.toLowerCase() === 'entrada') {
            sugerirMovimiento = 'Salida';
            debeBloquear = true;
        } else if (aeronave.movimiento?.toLowerCase() === 'salida') {
            sugerirMovimiento = 'Entrada';
            debeBloquear = true;
        }

        onChange({
            tipo: (aeronave.tipo || aeronave.tipo)?.toUpperCase() || '',
            aeronave: !aeronave.tipo_aeronave
                ? ''
                : (aeronave.tipo_aeronave.toLowerCase().includes('heli') ? 'Helicóptero' : 'Avión'),
            movimiento: sugerirMovimiento as any,
            destino: sugerirMovimiento === 'Salida' ? (aeronave.destino || '') : '',
            procedencia: sugerirMovimiento === 'Entrada' ? (aeronave.procedensia || '') : '',
            bloqueado: debeBloquear
        });
    };

    const subLabelStyle = "text-slate-500 text-[11px] font-semibold mb-1.5 block tracking-wider";
    const inputStyle = "w-full border border-slate-200 rounded-lg p-2.5 text-slate-700 font-medium focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 outline-none transition-all placeholder:text-slate-300 shadow-sm text-sm";
    const disabledStyle = "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed";

    const handleHoraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 4) val = val.slice(0, 4);

        let formatted = val;
        if (val.length >= 3) {
            formatted = `${val.slice(0, 2)}:${val.slice(2)}`;
        }
        const hours = parseInt(val.slice(0, 2));
        const minutes = parseInt(val.slice(2));

        if (hours > 23) return;
        if (minutes > 59) return;

        onChange({ hora: formatted });
    };

    return (
        <>
            <div>
                <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="relative">
                        <label className={subLabelStyle}>Matrícula</label>
                        <MatriculaAutocomplete
                            matricula={data.matricula}
                            onMatriculaChange={(val) => onChange({ matricula: val })}
                            onAeronaveData={handleAeronaveData}
                            onNuevaMatricula={() => console.log("Matrícula nueva")}
                        />
                    </div>
                    <div>
                        <label className={subLabelStyle}>Tipo</label>
                        <div className="flex gap-8 h-11 items-center">
                            {['Entrada', 'Salida'].map((op) => (
                                <label key={op} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="movimiento"
                                        // disabled={data.bloqueado}
                                        checked={data.movimiento === op}
                                        onChange={() => onChange({ movimiento: op as any, destino: '', procedencia: '' })}
                                        className="w-5 h-5 text-cyan-700 border-slate-300 focus:ring-cyan-600 cursor-pointer"
                                    />
                                    <span className={`text-sm font-bold ${data.movimiento === op ? 'text-cyan-800' : 'text-slate-500'}`}>
                                        {op}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={subLabelStyle}>Aeronave</label>
                        <select
                            className={inputStyle}
                            // disabled={data.bloqueado}
                            value={data.aeronave}
                            onChange={(e) => onChange({ aeronave: e.target.value as any })}
                        >
                            <option value="">Seleccione...</option>
                            <option value="Avión">Avión</option>
                            <option value="Helicóptero">Helicóptero</option>
                        </select>
                    </div>
                    <div>
                        <label className={subLabelStyle}>Equipo</label>
                        <input
                            type="text"
                            value={data.tipo}
                            onChange={(e) => onChange({ tipo: e.target.value.toUpperCase() })}
                            placeholder="Ej. C172"
                            // disabled={data.bloqueado}
                            className={inputStyle}
                        />
                    </div>
                    <div>
                        <label className={subLabelStyle}>Hora</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={data.hora}
                                onChange={handleHoraChange}
                                placeholder="HH:mm"
                                maxLength={5}
                                className={inputStyle}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                                hrs
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className={subLabelStyle}>Fecha</label>
                        <input
                            type="date"
                            value={data.fecha}
                            onChange={(e) => onChange({ fecha: e.target.value })}
                            className={inputStyle}
                        />
                    </div>
                    <div>
                        <label className={subLabelStyle}>Destino</label>
                        <input
                            type="text"
                            value={data.destino}
                            disabled={data.movimiento !== 'Salida'}
                            onChange={(e) => onChange({ destino: e.target.value.toUpperCase() })}
                            placeholder="Lugar de destino"
                            className={`${inputStyle} ${data.movimiento !== 'Salida' ? disabledStyle : ''}`}
                        />
                    </div>
                    <div>
                        <label className={subLabelStyle}>Procedencia</label>
                        <input
                            type="text"
                            value={data.procedencia}
                            disabled={data.movimiento !== 'Entrada'}
                            onChange={(e) => onChange({ procedencia: e.target.value.toUpperCase() })}
                            placeholder="Lugar de procedencia"
                            className={`${inputStyle} ${data.movimiento !== 'Entrada' ? disabledStyle : ''}`}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default GeneralInfo;
