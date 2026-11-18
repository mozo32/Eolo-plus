import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { ErrorDeApi, fetchRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import {
    ROL_FBO,
    ROL_JEFE_AREA,
    ROL_QUIEN_ENTREGA,
    formatearFecha,
    type DetalleRelevo,
    type FirmaRelevo,
} from './types';

interface Props {
    id: number | null;
    onCerrar: () => void;
}

const firmaPorRol = (detalle: DetalleRelevo, rol: string): FirmaRelevo | null =>
    detalle.firmas.find(firma => firma.rol === rol) ?? null;

function Firma({ firma, titulo }: { firma: FirmaRelevo | null; titulo: string }) {
    return (
        <div className="text-center">
            <div className="flex h-16 items-center justify-center border-b border-slate-400">
                {firma ? (
                    <img src={firma.url} alt={titulo} className="max-h-16" />
                ) : (
                    <span className="text-[9px] font-bold uppercase text-slate-300">Sin firma</span>
                )}
            </div>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
        </div>
    );
}

function Documento({ detalle }: { detalle: DetalleRelevo }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                    {detalle.nombre} · {detalle.hora}
                </p>
                <ul className="divide-y divide-slate-100">
                    {detalle.resumen.renglones.map(renglon => (
                        <li key={renglon.clave} className="flex items-center justify-between gap-3 py-1.5 text-xs text-slate-700">
                            <span className="font-bold">{renglon.titulo}</span>
                            <span className="text-right">{renglon.texto}</span>
                        </li>
                    ))}
                </ul>
                <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Observaciones</p>
                    <p className="whitespace-pre-wrap text-xs text-slate-700">{detalle.observaciones?.trim() || '—'}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                    <Firma firma={firmaPorRol(detalle, ROL_QUIEN_ENTREGA)} titulo="Quien entrega" />
                    <Firma firma={firmaPorRol(detalle, ROL_JEFE_AREA)} titulo="Jefe de área" />
                    <Firma firma={firmaPorRol(detalle, ROL_FBO)} titulo="FBO" />
                </div>
            </div>
        </section>
    );
}

export default function VistaPreviaEntregaTurno({ id, onCerrar }: Props) {
    const [detalle, setDetalle] = useState<DetalleRelevo | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDetalle(null);
        setError(null);

        if (id === null) return;

        let vigente = true;
        setCargando(true);

        fetchRelevo(id)
            .then(respuesta => {
                if (vigente) setDetalle(respuesta.data);
            })
            .catch((e: unknown) => {
                if (vigente) setError(e instanceof ErrorDeApi ? e.message : 'No se pudo conectar con el servidor.');
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });

        return () => {
            vigente = false;
        };
    }, [id]);

    if (id === null) return null;

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 md:p-6">
            <button
                type="button"
                aria-label="Cerrar vista previa"
                onClick={onCerrar}
                className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300"
            />

            <div className="relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 md:text-lg">Vista previa de la entrega de turno</h3>
                        {detalle && (
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{formatearFecha(detalle.fecha)}</p>
                        )}
                    </div>
                    <button type="button" onClick={onCerrar} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500" title="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-100 p-3 md:p-6">
                    {/* Sin detalle ni error aún (primer render tras elegir relevo) también es «cargando». */}
                    {cargando || (!error && !detalle) ? (
                        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white">
                            <LoaderCircle size={34} className="mb-3 animate-spin text-[#003E51]" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando vista previa...</p>
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertCircle size={34} className="mb-3 text-red-500" />
                            <h4 className="text-sm font-black uppercase text-red-700">No se pudo cargar</h4>
                            <p className="mt-2 text-xs text-red-600">{error}</p>
                        </div>
                    ) : detalle ? (
                        <Documento detalle={detalle} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
