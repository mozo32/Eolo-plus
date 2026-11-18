import { ETIQUETA_ROL } from './types';

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

/** Verde si el relevo está cerrado, naranja si le falta alguna firma de cierre. */
export function DistintivoFirmas({ faltantes }: { faltantes: string[] }) {
    const cerrado = faltantes.length === 0;

    return (
        <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                cerrado ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
            }`}
        >
            {textoDelDistintivo(faltantes)}
        </span>
    );
}
