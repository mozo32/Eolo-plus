import { useEffect, useState } from 'react';
import { AlertCircle, ClipboardCheck, UserCheck, X } from 'lucide-react';
import { ErrorDeApi, fetchPendientesRelevo } from '@/stores/apiEntregaTurnoSeguridad';
import { ETIQUETA_SECCION, formatearFecha, type PendienteRelevo } from './types';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onFirmar: (id: number) => void;
}

/** Cola de relevos sin firma del FBO. Lo más viejo va primero, tal como lo manda el servidor: no se reordena aquí. */
export default function PendientesFirmaFbo({ abierto, onCerrar, onFirmar }: Props) {
    const [pendientes, setPendientes] = useState<PendienteRelevo[] | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!abierto) return;

        let vigente = true;
        setPendientes(null);
        setCargando(true);
        setError(null);

        fetchPendientesRelevo()
            .then(({ data }) => {
                if (vigente) setPendientes(data);
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
    }, [abierto]);

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-[80] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={onCerrar} />

            <div className="relative z-10 flex h-screen w-full max-w-md flex-col border-l border-slate-100 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
                    <div>
                        <h3 className="text-base font-black uppercase tracking-tighter text-slate-800">Pendientes de firma</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Relevos sin firma del FBO</p>
                    </div>
                    <button type="button" onClick={onCerrar} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-6">
                    {cargando || (!error && pendientes === null) ? (
                        <div className="py-20 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Cargando pendientes...</div>
                    ) : error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertCircle size={32} className="mx-auto mb-2 text-red-500" />
                            <p className="text-xs font-black uppercase text-red-700">No se pudo cargar</p>
                            <p className="mt-1 text-[10px] text-red-600">{error}</p>
                        </div>
                    ) : pendientes !== null && pendientes.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 py-20 text-center">
                            <UserCheck size={32} className="mx-auto mb-2 text-emerald-500" />
                            <p className="text-xs font-black uppercase tracking-tighter text-emerald-800">¡Al día!</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase text-emerald-600">Todos los relevos tienen la firma del FBO.</p>
                        </div>
                    ) : (
                        (pendientes ?? []).map(pendiente => (
                            <div key={pendiente.id} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 transition-all hover:bg-slate-100/70">
                                <div className="mr-2 min-w-0">
                                    <p className="truncate text-xs font-black uppercase tracking-tight text-slate-800">{pendiente.nombre}</p>
                                    <p className="text-[10px] font-medium text-slate-400">
                                        {formatearFecha(pendiente.fecha)} {pendiente.hora} · {ETIQUETA_SECCION[pendiente.seccion]}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onFirmar(pendiente.id)}
                                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700 shadow-xs transition-all hover:border-indigo-600 hover:bg-indigo-600 hover:text-white active:scale-95"
                                >
                                    <ClipboardCheck size={12} />
                                    <span>Firmar</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
