import type { FirmaRelevo } from './types';

/** La firma que el relevo ya tiene, para que nadie dibuje encima sin saberlo. */
export default function FirmaActual({ firma }: { firma: FirmaRelevo | null }) {
    if (firma === null) {
        return null;
    }

    return (
        <div className="mb-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">Firma actual</p>
            <img src={firma.url} alt="Firma registrada" className="h-16 rounded border border-slate-200 bg-white" />
            <p className="text-[10px] text-slate-400">Dibujar una nueva la reemplaza; la anterior queda en el historial.</p>
        </div>
    );
}
