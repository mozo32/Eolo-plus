import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { eliminarEvidenciaComisariato, subirEvidenciaComisariato } from '@/stores/apiServicioComisariato';
import { comprimirImagen } from './comprimirImagen';

export type FotoEvidencia = {
    /** null mientras no se haya subido: el servicio todavía no existe. */
    id: number | null;
    /** La URL del servidor, o un data URL local si aún está sin subir. */
    url: string;
};

type Props = {
    abierto: boolean;
    /** null durante el alta, antes de guardar el servicio. */
    servicioId: number | null;
    fotos: FotoEvidencia[];
    onCerrar: () => void;
    /** Se llama tras cada alta o baja, con la lista completa ya actualizada. */
    onCambio: (fotos: FotoEvidencia[]) => void;
};

const botonPrimario =
    'flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50';
const botonSecundario =
    'flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50';

/**
 * Evidencias fotográficas de un servicio de Comisariato. En producción el
 * sistema se usa por HTTP en la LAN, donde getUserMedia no existe: la ruta que
 * corre a diario es el input nativo con capture, que abre la cámara del aparato.
 * La cámara en vivo se enciende sola el día que el servidor tenga HTTPS.
 */
export default function CamaraEvidencias({ abierto, servicioId, fotos, onCerrar, onCambio }: Props) {
    const [camaraAbierta, setCamaraAbierta] = useState(false);
    const [errorCamara, setErrorCamara] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const camaraDisponible = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    // Cerrar el modal apaga la cámara aunque camaraAbierta siga en true.
    const camaraActiva = abierto && camaraAbierta;

    const detenerCamara = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        if (!camaraActiva) return;

        let cancelado = false;

        const iniciar = async () => {
            setErrorCamara('');

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });

                if (cancelado) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch {
                setErrorCamara('No se pudo abrir la cámara. Usa «Añadir foto» para tomarla con el aparato.');
                setCamaraAbierta(false);
            }
        };

        void iniciar();

        return () => {
            cancelado = true;
            detenerCamara();
        };
    }, [camaraActiva, detenerCamara]);

    const cerrar = () => {
        setCamaraAbierta(false);
        onCerrar();
    };

    const aceptarFoto = async (origen: File | Blob) => {
        setSubiendo(true);
        setError('');

        try {
            const dataUrl = await comprimirImagen(origen);

            if (servicioId === null) {
                onCambio([...fotos, { id: null, url: dataUrl }]);
                return;
            }

            const guardada = await subirEvidenciaComisariato(servicioId, dataUrl);

            // El store devuelve data.data sin guardia: una respuesta 2xx sin cuerpo llegaría como undefined.
            if (!guardada || typeof guardada.id !== 'number') {
                throw new Error('El servidor no confirmó la fotografía. Inténtalo de nuevo.');
            }

            onCambio([...fotos, { id: guardada.id, url: guardada.url }]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar la fotografía.');
        } finally {
            setSubiendo(false);
        }
    };

    const quitarFoto = async (indice: number) => {
        const foto = fotos[indice];

        // Una foto sin id nunca llegó al servidor: basta con sacarla de la lista.
        if (foto.id !== null && servicioId !== null) {
            try {
                await eliminarEvidenciaComisariato(servicioId, foto.id);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo eliminar la fotografía.');
                return;
            }
        }

        onCambio(fotos.filter((_, i) => i !== indice));
    };

    const tomarFotografia = () => {
        const video = videoRef.current;

        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            setErrorCamara('Espera un momento a que la cámara termine de cargar.');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const contexto = canvas.getContext('2d');
        if (!contexto) {
            setErrorCamara('No fue posible procesar la fotografía.');
            return;
        }

        contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            blob => {
                if (!blob) {
                    setErrorCamara('No fue posible guardar la fotografía. Inténtalo nuevamente.');
                    return;
                }

                setCamaraAbierta(false);
                void aceptarFoto(blob);
            },
            'image/jpeg',
            0.85,
        );
    };

    const seleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0];
        // Se limpia el input para poder tomar otra foto igual enseguida.
        e.target.value = '';
        if (archivo) void aceptarFoto(archivo);
    };

    const anadirFoto = () => {
        setError('');
        setErrorCamara('');

        if (camaraDisponible) {
            setCamaraAbierta(true);
        } else {
            inputRef.current?.click();
        }
    };

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Evidencias fotográficas">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Evidencias fotográficas</h2>
                    <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={seleccionarArchivo} className="hidden" />

                {camaraActiva && (
                    <div className="space-y-3">
                        <div className="overflow-hidden rounded-xl bg-black">
                            <video ref={videoRef} autoPlay muted playsInline className="h-64 w-full object-cover" />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button type="button" onClick={() => setCamaraAbierta(false)} className={botonSecundario}>
                                Cancelar cámara
                            </button>
                            <button type="button" onClick={tomarFotografia} className={`${botonPrimario} flex-1`}>
                                <Camera size={18} />
                                Tomar fotografía
                            </button>
                        </div>
                    </div>
                )}

                {fotos.length === 0 && !subiendo ? (
                    <p className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                        Aún no hay fotografías.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {fotos.map((foto, indice) => (
                            <div key={foto.id ?? `pendiente-${indice}`} className="relative overflow-hidden rounded-lg border border-gray-200 bg-slate-950">
                                <img src={foto.url} alt={`Evidencia ${indice + 1}`} className="h-24 w-full object-cover" />
                                {foto.id === null && (
                                    <span className="absolute bottom-1 left-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white">Pendiente</span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void quitarFoto(indice)}
                                    disabled={subiendo}
                                    aria-label={`Quitar evidencia ${indice + 1}`}
                                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}

                        {subiendo && (
                            <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                                <Loader2 size={18} className="animate-spin" />
                                Subiendo…
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <button type="button" onClick={anadirFoto} disabled={subiendo} className={`${botonPrimario} w-full`}>
                        <ImagePlus size={18} />
                        Añadir foto
                    </button>

                    {!camaraDisponible && (
                        <p className="text-xs text-gray-400">La página no está en HTTPS, por eso se usa la cámara del aparato en lugar de la cámara en vivo.</p>
                    )}

                    {servicioId === null && (
                        <p className="text-xs text-gray-400">Las fotografías se subirán al guardar el servicio.</p>
                    )}
                </div>

                {errorCamara && (
                    <p className="text-sm font-medium text-amber-700" role="alert">
                        {errorCamara}
                    </p>
                )}

                {error && (
                    <p className="text-sm font-medium text-red-600" role="alert">
                        {error}
                    </p>
                )}

                <button type="button" onClick={cerrar} className={botonSecundario}>
                    Listo
                </button>
            </div>
        </div>
    );
}
