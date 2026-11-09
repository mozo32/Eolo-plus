import { ETIQUETA_ROL, type FilaRelevo, type SeccionRelevo } from './types';

/** Lo que dice el distintivo según cuántas firmas de cierre falten. */
function textoDelDistintivo(faltantes: string[]): string {
    if (faltantes.length === 0) {
        return 'Firmado';
    }

    if (faltantes.length === 1) {
        return `Falta ${ETIQUETA_ROL[faltantes[0]] ?? faltantes[0]}`;
    }

    return `Faltan ${faltantes.length}`;
}

/** Lo que se ve de un puesto: quién, a qué hora y qué firmas le faltan. */
export function CeldaSeccion({ seccion }: { seccion: SeccionRelevo | null }) {
    if (seccion === null) {
        return <span className="text-[10px] font-bold uppercase text-slate-300">—</span>;
    }

    const cerrado = seccion.firmas_faltantes.length === 0;

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-bold text-slate-700">{seccion.nombre}</span>
            <span className="text-[10px] text-slate-400">{seccion.hora}</span>
            <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                    cerrado ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                }`}
            >
                {textoDelDistintivo(seccion.firmas_faltantes)}
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
 * La pernocta del día que enseña la tabla.
 *
 * Si los dos puestos traen números distintos se imprimen LOS DOS, la caseta
 * primero: pasa cuando uno quedó congelado antes que el otro, y quedarse con
 * uno borraría lo que dice el otro documento.
 */
export function pernoctaDelDia(fila: FilaRelevo): string {
    const numeros = [fila.caseta?.pernocta, fila.plataforma?.pernocta]
        .filter((numero): numero is number => numero !== undefined);

    if (numeros.length === 0) {
        return '—';
    }

    return [...new Set(numeros)].join(' / ');
}

/** El id sobre el que actuar, o null si hay que preguntar primero. */
export function idUnicoDe(fila: FilaRelevo): number | null {
    const presentes = [fila.caseta, fila.plataforma].filter(
        (seccion): seccion is SeccionRelevo => seccion !== null,
    );

    return presentes.length === 1 ? presentes[0].id : null;
}
