import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw, X } from 'lucide-react';
import {
    descargarReporteRapidoOperacionesPdf,
    prepararReporteRapidoOperacionesPdf,
} from './ReporteRapidoOperacionesPdf';
import type { FiltrosReporte } from './ReporteRapidoOperacionesPdf';

interface ReporteRapidoOperacionesModalProps {
    open: boolean;
    onClose: () => void;
    filtros: FiltrosReporte;
}

const ReporteRapidoOperacionesModal = ({
    open,
    onClose,
    filtros,
}: ReporteRapidoOperacionesModalProps) => {
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');
    const [blob, setBlob] = useState<Blob | null>(null);
    const [urlVistaPrevia, setUrlVistaPrevia] = useState('');
    const urlVistaPreviaRef = useRef('');

    const liberarUrlVistaPrevia = () => {
        if (urlVistaPreviaRef.current) {
            URL.revokeObjectURL(urlVistaPreviaRef.current);
            urlVistaPreviaRef.current = '';
        }
    };

    useEffect(() => {
        if (!open) {
            liberarUrlVistaPrevia();
            setBlob(null);
            setUrlVistaPrevia('');
            setError('');
            setCargando(false);
            setDescargando(false);
            return;
        }

        let activo = true;

        const cargarVistaPrevia = async () => {
            setCargando(true);
            setError('');
            setBlob(null);
            setUrlVistaPrevia('');
            liberarUrlVistaPrevia();

            try {
                const reporte = await prepararReporteRapidoOperacionesPdf(filtros);

                if (!activo) return;

                const urlTemporal = URL.createObjectURL(reporte.blob);
                urlVistaPreviaRef.current = urlTemporal;
                setBlob(reporte.blob);
                setUrlVistaPrevia(urlTemporal);
            } catch (error: any) {
                if (!activo) return;

                setError(
                    error?.message ||
                    'No fue posible generar la vista previa del reporte.'
                );
            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        };

        cargarVistaPrevia();

        return () => {
            activo = false;
            liberarUrlVistaPrevia();
        };
    }, [open, filtros]);

    useEffect(() => {
        if (!open) return;

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', cerrarConEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', cerrarConEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const recargarVistaPrevia = async () => {
        setCargando(true);
        setError('');
        setBlob(null);
        setUrlVistaPrevia('');
        liberarUrlVistaPrevia();

        try {
            const reporte = await prepararReporteRapidoOperacionesPdf(filtros);
            const nuevaUrl = URL.createObjectURL(reporte.blob);

            urlVistaPreviaRef.current = nuevaUrl;
            setBlob(reporte.blob);
            setUrlVistaPrevia(nuevaUrl);
        } catch (error: any) {
            setError(
                error?.message ||
                'No fue posible generar la vista previa del reporte.'
            );
        } finally {
            setCargando(false);
        }
    };

    const generarPdf = () => {
        if (!blob) return;

        setDescargando(true);

        try {
            descargarReporteRapidoOperacionesPdf(blob, filtros);
        } finally {
            setDescargando(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <FileText size={20} />
                        </div>

                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-black uppercase tracking-wide text-slate-800">
                                Vista previa del reporte rápido
                            </h2>
                            <p className="truncate text-xs text-slate-500">
                                Resumen semanal de operaciones
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
                    {cargando && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <Loader2
                                size={36}
                                className="mb-3 animate-spin text-blue-600"
                            />
                            <p className="text-sm font-black uppercase tracking-wide text-slate-700">
                                Generando vista previa
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Consultando la información del reporte...
                            </p>
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-white px-6 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <FileText size={28} />
                            </div>

                            <p className="text-sm font-black uppercase text-slate-800">
                                Sin vista previa
                            </p>
                            <p className="mt-2 max-w-md text-sm text-slate-500">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={recargarVistaPrevia}
                                className="mt-5 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-700"
                            >
                                <RefreshCw size={15} />
                                Reintentar
                            </button>
                        </div>
                    )}

                    {!cargando && !error && urlVistaPrevia && (
                        <iframe
                            title="Vista previa del reporte rápido de operaciones"
                            src={`${urlVistaPrevia}#toolbar=0&navpanes=0&scrollbar=1`}
                            className="h-full w-full rounded-xl border border-slate-300 bg-white shadow-sm"
                        />
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Cerrar
                    </button>

                    <button
                        type="button"
                        onClick={generarPdf}
                        disabled={!blob || cargando || descargando}
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {descargando ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Download size={16} />
                        )}
                        Generar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReporteRapidoOperacionesModal;
