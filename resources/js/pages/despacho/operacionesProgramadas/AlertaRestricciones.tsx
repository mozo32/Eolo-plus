import { ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MatriculaRestringida } from './types';

interface Props {
    restricciones: MatriculaRestringida[];
}

/** Qué movimiento tiene bloqueado cada matrícula. */
const movimientoBloqueado = (restriccion: MatriculaRestringida): string => {
    if (restriccion.llegada && restriccion.salida) return 'Ambas';
    if (restriccion.llegada) return 'Llegada';
    if (restriccion.salida) return 'Salida';
    return '';
};

/**
 * Alerta junto al título con las matrículas restringidas.
 *
 * Se despliega al pasar el mouse y también al hacer clic: el clic la fija, para
 * que en pantallas táctiles, donde no hay hover, se pueda abrir y cerrar.
 * Solo cuenta las matrículas que realmente tienen algún movimiento bloqueado;
 * si no hay ninguna, el icono no aparece.
 */
export default function AlertaRestricciones({ restricciones }: Props) {
    const conBloqueo = restricciones.filter(r => r.llegada || r.salida);

    const [fijado, setFijado] = useState(false);
    const [sobre, setSobre] = useState(false);
    const contenedor = useRef<HTMLDivElement>(null);

    // Un clic fuera cierra el panel fijado.
    useEffect(() => {
        if (!fijado) return;

        const alHacerClicFuera = (evento: MouseEvent) => {
            if (!contenedor.current?.contains(evento.target as Node)) setFijado(false);
        };

        document.addEventListener('mousedown', alHacerClicFuera);
        return () => document.removeEventListener('mousedown', alHacerClicFuera);
    }, [fijado]);

    if (conBloqueo.length === 0) return null;

    const abierto = fijado || sobre;

    return (
        <div
            ref={contenedor}
            className="relative"
            onMouseEnter={() => setSobre(true)}
            onMouseLeave={() => setSobre(false)}
        >
            <button
                type="button"
                onClick={() => setFijado(previo => !previo)}
                aria-expanded={abierto}
                aria-label={`${conBloqueo.length} ${conBloqueo.length === 1 ? 'matrícula restringida' : 'matrículas restringidas'}`}
                className="relative flex items-center justify-center rounded-xl p-1 text-red-600 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
                <ShieldAlert size={36} strokeWidth={2.2} />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow">
                    {conBloqueo.length > 99 ? '99+' : conBloqueo.length}
                </span>
            </button>

            {abierto && (
                <div
                    role="tooltip"
                    className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                >
                    <div className="border-b border-slate-100 bg-red-50 px-4 py-2.5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-red-700">
                            Matrículas restringidas
                        </p>
                        <p className="text-[10px] font-semibold text-red-500">
                            No se pueden programar estos movimientos
                        </p>
                    </div>

                    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                        {conBloqueo.map(restriccion => (
                            <li
                                key={restriccion.matricula}
                                className="flex items-center justify-between px-4 py-2.5"
                            >
                                <span className="text-sm font-black uppercase tracking-tighter text-slate-800">
                                    {restriccion.matricula}
                                </span>
                                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                                    {movimientoBloqueado(restriccion)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
