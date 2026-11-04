import { ETIQUETA_PERNOCTA, type FilaRelevo, type Pernocta, type SeccionRelevo } from './types';

/** Lo que se ve de una sección: quién, a qué hora y si el FBO ya firmó. */
export function CeldaSeccion({ seccion }: { seccion: SeccionRelevo | null }) {
    if (seccion === null) {
        return <span className="text-[10px] font-bold uppercase text-slate-300">—</span>;
    }

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-bold text-slate-700">{seccion.nombre}</span>
            <span className="text-[10px] text-slate-400">{seccion.hora}</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    seccion.firmado_fbo
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-orange-100 text-orange-600'
                }`}
            >
                {seccion.firmado_fbo ? 'Firmado' : 'Falta FBO'}
            </span>
            {seccion.extras > 0 && (
                <span className="text-[9px] font-bold uppercase text-slate-400">
                    {seccion.extras + 1} registros
                </span>
            )}
        </div>
    );
}

/**
 * La pernocta mensual del día.
 *
 * Si las dos secciones no coinciden se imprimen LAS DOS, el frente
 * primero. Resumirlas a una obligaría a decidir cuál gana, y cualquier
 * elección borraría lo que una de las dos dijo.
 */
export function pernoctaDelDia(fila: FilaRelevo): string {
    const estados = [fila.frente?.pernocta_mensual, fila.atras?.pernocta_mensual]
        .filter((estado): estado is Pernocta => estado !== undefined);

    if (estados.length === 0) {
        return '—';
    }

    const etiquetas = [...new Set(estados)].map(estado => ETIQUETA_PERNOCTA[estado]);

    return etiquetas.join(' / ');
}

/** El id sobre el que actuar, o null si hay que preguntar primero. */
export function idUnicoDe(fila: FilaRelevo): number | null {
    const presentes = [fila.frente, fila.atras].filter(
        (seccion): seccion is SeccionRelevo => seccion !== null,
    );

    return presentes.length === 1 ? presentes[0].id : null;
}
