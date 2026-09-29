import type { ReactNode } from 'react';

interface Props {
    titulo: string;
    descripcion: string;
    /** Botones de la derecha. */
    children?: ReactNode;
}

/** Tarjeta de encabezado de las pantallas de Facturación (igual a la de Préstamo de chalecos). */
export default function CabeceraPantalla({ titulo, descripcion, children }: Props) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{titulo}</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{descripcion}</p>
            </div>

            {children && <div className="flex gap-2 items-center">{children}</div>}
        </div>
    );
}
