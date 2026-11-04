import { X } from 'lucide-react';
import { ETIQUETA_SECCION, formatearFecha, SECCIONES, type FilaRelevo } from './types';

interface Props {
    fila: FilaRelevo;
    accion: 'editar' | 'eliminar';
    onElegir: (id: number) => void;
    onCerrar: () => void;
}

/**
 * Pregunta sobre cuál registro del día se actúa. Editar y eliminar tocan
 * UN registro: borrar «el día» borraría el trabajo de otra persona.
 */
export default function SelectorSeccion({ fila, accion, onElegir, onCerrar }: Props) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCerrar} />

            <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                    <div>
                        <h3 className="text-sm font-black uppercase text-slate-700">
                            ¿Qué sección quieres {accion}?
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {formatearFecha(fila.fecha)}
                        </p>
                    </div>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-2 p-4">
                    {SECCIONES.map(clave => {
                        const seccion = fila[clave];

                        if (seccion === null) {
                            return null;
                        }

                        return (
                            <button
                                key={clave}
                                type="button"
                                onClick={() => onElegir(seccion.id)}
                                className="flex flex-col items-center gap-0.5 rounded border border-slate-200 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                    {ETIQUETA_SECCION[clave]}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700">{seccion.nombre}</span>
                                <span className="text-[10px] text-slate-400">{seccion.hora}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
