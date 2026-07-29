import type { ChangeEvent } from 'react';

import MovimientoCSAEEntrada from './MovimientoCSAEEntrada';
import MovimientoCSAESalida from './MovimientoCSAESalida';

import {
    ArrowDown,
    FilePenLine,
} from 'lucide-react';

interface Props {
    data: any;

    onChange: (
        event: ChangeEvent<
            HTMLInputElement |
            HTMLTextAreaElement |
            HTMLSelectElement
        >,
    ) => void;

    updateField: (key: string, value: any) => void;
}

export default function MovimientoCSAEEditarCompleto({
    data,
    onChange,
    updateField,
}: Props) {
    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <div className="flex flex-col justify-between gap-4 rounded-[2rem] bg-blue-900 p-6 text-white shadow-xl md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-blue-800 p-3">
                        <FilePenLine size={26} />
                    </div>

                    <div>
                        <h2 className="text-xl font-black tracking-tight">
                            Edición completa del movimiento
                        </h2>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                            Modifique los datos de entrada y salida
                        </p>
                    </div>
                </div>

                <span className="rounded-2xl border border-blue-700 bg-blue-800/50 px-4 py-2 font-mono text-sm font-black">
                    {data.matricula || 'SIN MATRÍCULA'}
                </span>
            </div>

            <MovimientoCSAEEntrada
                data={data}
                onChange={onChange}
                updateField={updateField}
            />

            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />

                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                    <ArrowDown size={14} />
                    Información de salida
                </div>

                <div className="h-px flex-1 bg-slate-200" />
            </div>

            <MovimientoCSAESalida
                data={data}
                onChange={onChange}
                updateField={updateField}
            />
        </div>
    );
}
