import { fetchShowServicioComisariato } from '@/stores/apiServicioComisariato';
import { PDFViewer } from '@react-pdf/renderer';
import { AlertCircle, Download, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ComisariatoPdfDoc, evidenciasEnDataUrl } from './PdfComisariato';

interface Props {
    /** Renglón a previsualizar, o null si la ventana está cerrada. */
    id: number | null;
    onCerrar: () => void;
    /** Dispara la descarga que ya existe en la pantalla; aquí no se duplica. */
    onDescargar: (id: number) => void;
}

/**
 * Muestra el recibo de comisariato sin descargarlo.
 *
 * Pinta el MISMO documento que se descarga, con `PDFViewer`, para que no haya
 * dos maquetas que mantener. La barra gris del visor de Chrome va oculta: el
 * botón de abajo es la vía para bajarlo.
 */
export default function VistaPreviaComisariato({ id, onCerrar, onDescargar }: Props) {
    const [datos, setDatos] = useState<any>(null);
    const [fotos, setFotos] = useState<string[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDatos(null);
        setFotos([]);
        setError(null);

        if (id === null) {
            return;
        }

        let vigente = true;
        setCargando(true);

        fetchShowServicioComisariato(id)
            .then(async (respuesta: any) => {
                const recibo = respuesta?.data ?? respuesta;
                // Las fotos se preparan aquí, bajo la misma bandera, para que
                // una respuesta tardía no pinte un documento ya abandonado.
                const evidencias = await evidenciasEnDataUrl(recibo);

                if (vigente) {
                    setFotos(evidencias);
                    setDatos(recibo);
                }
            })
            .catch(() => {
                if (vigente) {
                    setError('No se pudo cargar el recibo.');
                }
            })
            .finally(() => {
                if (vigente) {
                    setCargando(false);
                }
            });

        // Si se cierra o se cambia de renglón antes de que llegue la respuesta,
        // la anterior ya no debe pintarse.
        return () => {
            vigente = false;
        };
    }, [id]);

    if (id === null) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 md:p-6">
            <button
                type="button"
                aria-label="Cerrar vista previa"
                onClick={onCerrar}
                className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60 backdrop-blur-sm"
            />

            <div className="relative z-10 flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-700">Vista previa del recibo</h3>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            #COM-{id}
                            {datos?.matricula ? ` · ${datos.matricula}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onCerrar} className="rounded p-2 text-slate-400 transition-colors hover:text-red-500" title="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden bg-slate-100">
                    {cargando || (!error && !datos) ? (
                        <div className="flex h-full flex-col items-center justify-center">
                            <LoaderCircle size={34} className="mb-3 animate-spin text-[#003E51]" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando el recibo...</p>
                        </div>
                    ) : error ? (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                            <AlertCircle size={34} className="mb-3 text-red-500" />
                            <h4 className="text-sm font-black uppercase text-red-700">No se pudo cargar</h4>
                            <p className="mt-2 text-xs text-red-600">{error}</p>
                        </div>
                    ) : (
                        <PDFViewer showToolbar={false} className="h-full w-full border-0">
                            <ComisariatoPdfDoc data={datos} fotos={fotos} />
                        </PDFViewer>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        disabled={datos === null}
                        onClick={() => onDescargar(id)}
                        className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Download size={14} />
                        Descargar
                    </button>
                </div>
            </div>
        </div>
    );
}
