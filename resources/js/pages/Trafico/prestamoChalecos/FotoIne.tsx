import { Camera, ImagePlus, Maximize2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { FOTO_ACCEPT, FOTO_TAMANO_MAXIMO_MB, formatearTamano, validarArchivoFoto } from './types';
import VisorEvidencia from './VisorEvidencia';

interface Props {
    value: File | null;
    onChange: (archivo: File | null) => void;
    /** Error de validación del formulario (por ejemplo, "falta la fotografía"). */
    error?: string;
    /** Botón que recibe el foco cuando el formulario detecta que falta la foto. */
    focoRef?: RefObject<HTMLButtonElement | null>;
    disabled?: boolean;
}

/**
 * Una sola fotografía de la INE, con el mismo patrón que las evidencias de
 * Movimientos de vehículos EOLO: cámara en vivo (getUserMedia) o selección
 * desde el dispositivo, el File solo en memoria y la vista previa con
 * URL.createObjectURL, que se revoca al reemplazar, eliminar o desmontar.
 *
 * Privacidad: nunca se convierte a Base64, no se guarda en localStorage ni se
 * envía a ningún lado desde aquí. Eso lo decidirá el backend cuando exista.
 */
export default function FotoIne({ value, onChange, error, focoRef, disabled = false }: Props) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [ampliada, setAmpliada] = useState(false);
    const [camaraAbierta, setCamaraAbierta] = useState(false);
    const [errorCamara, setErrorCamara] = useState('');
    const [errorArchivo, setErrorArchivo] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // La URL temporal vive exactamente lo que vive el File en pantalla: al
    // cambiar de archivo, quitarlo o desmontar, la limpieza revoca la anterior.
    // Crear y revocar dentro del mismo efecto es lo que mantiene la vista
    // previa válida bajo StrictMode (montaje → limpieza → montaje).
    useEffect(() => {
        if (!value) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(value);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [value]);

    const detenerCamara = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        if (!camaraAbierta) return;

        let cancelado = false;

        const iniciar = async () => {
            setErrorCamara('');

            if (!navigator.mediaDevices?.getUserMedia) {
                setErrorCamara('Este navegador no permite abrir la cámara en vivo. Usa "Seleccionar imagen" o verifica que el sistema use HTTPS.');
                setCamaraAbierta(false);
                return;
            }

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
                setErrorCamara('No se pudo acceder a la cámara. Revisa los permisos o selecciona una imagen del dispositivo.');
                setCamaraAbierta(false);
            }
        };

        void iniciar();

        return () => {
            cancelado = true;
            detenerCamara();
        };
    }, [camaraAbierta, detenerCamara]);

    const aceptarArchivo = (archivo: File) => {
        const mensaje = validarArchivoFoto(archivo);
        if (mensaje) {
            setErrorArchivo(mensaje);
            return;
        }

        setErrorArchivo('');
        setErrorCamara('');
        onChange(archivo);
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

        // Resolución completa: la INE debe quedar legible.
        contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            blob => {
                if (!blob) {
                    setErrorCamara('No fue posible guardar la fotografía. Inténtalo nuevamente.');
                    return;
                }

                aceptarArchivo(new File([blob], `ine-${Date.now()}.jpg`, { type: 'image/jpeg' }));
                setCamaraAbierta(false);
            },
            'image/jpeg',
            0.85,
        );
    };

    const seleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0];
        // Se limpia el input para poder elegir el mismo archivo otra vez.
        e.target.value = '';
        if (archivo) aceptarArchivo(archivo);
    };

    const abrirCamara = () => {
        setErrorArchivo('');
        setErrorCamara('');
        setCamaraAbierta(true);
    };

    const eliminar = () => {
        setErrorArchivo('');
        setErrorCamara('');
        onChange(null);
    };

    const errorVisible = errorArchivo || error;

    // Clases tomadas de la evidencia de Movimientos de vehículos EOLO (ModalMovimiento).
    const botonPrimario =
        'flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50';
    const botonSecundario =
        'flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50';

    return (
        <div className="space-y-3">
            <input ref={inputRef} type="file" accept={FOTO_ACCEPT} onChange={seleccionarArchivo} className="hidden" disabled={disabled} />

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Fotografía de la INE
                    <span className="text-red-500"> *</span>
                </label>
                <p className="text-xs text-gray-400">Toma o selecciona una fotografía legible de la identificación de quien recibe el chaleco.</p>
            </div>

            {camaraAbierta ? (
                <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl bg-black">
                        <video ref={videoRef} autoPlay muted playsInline className="h-64 w-full object-cover" />

                        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                            {value ? 'Repitiendo fotografía' : 'Fotografía de la INE'}
                        </div>
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
            ) : (
                <div
                    className={`rounded-xl border-2 border-dashed p-4 text-center ${
                        errorVisible ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-gray-50'
                    }`}
                >
                    <Camera className="mx-auto mb-2 text-gray-400" size={36} />
                    <p className="mb-3 text-sm text-gray-500">
                        {value ? 'Puedes repetir o cambiar la fotografía antes de guardar.' : 'Aún no se ha tomado ninguna fotografía.'}
                    </p>

                    <div className="flex flex-col justify-center gap-2 sm:flex-row">
                        <button ref={focoRef} type="button" onClick={abrirCamara} disabled={disabled} className={`${botonPrimario} mx-auto sm:mx-0`}>
                            <Camera size={18} />
                            {value ? 'Repetir con cámara' : 'Encender cámara'}
                        </button>

                        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} className={`${botonSecundario} mx-auto sm:mx-0`}>
                            <ImagePlus size={18} />
                            {value ? 'Elegir otra imagen' : 'Seleccionar imagen'}
                        </button>
                    </div>

                    <p className="mt-3 text-xs text-gray-400">
                        JPG, PNG o WEBP · máximo {FOTO_TAMANO_MAXIMO_MB} MB
                    </p>
                </div>
            )}

            {value && previewUrl && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-600">Fotografía capturada</p>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">1 foto</span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <div className="relative">
                            <img src={previewUrl} alt="Fotografía de la INE" className="h-40 w-full bg-slate-950 object-contain" />
                            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white">INE</span>
                            <span className="absolute right-2 top-2 max-w-[60%] truncate rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white" title={value.name}>
                                {value.name} · {formatearTamano(value.size)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2">
                            <button
                                type="button"
                                onClick={() => setAmpliada(true)}
                                className="flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Maximize2 size={15} />
                                Ampliar
                            </button>

                            <button
                                type="button"
                                onClick={eliminar}
                                disabled={disabled}
                                className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            >
                                <Trash2 size={15} />
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {errorCamara && (
                <p className="text-sm font-medium text-amber-700" role="alert">
                    {errorCamara}
                </p>
            )}

            {errorVisible && (
                <p className="text-sm font-medium text-red-600" role="alert">
                    {errorVisible}
                </p>
            )}

            <p className="text-xs text-gray-400">La imagen será utilizada únicamente como evidencia del préstamo.</p>

            {ampliada && previewUrl && <VisorEvidencia url={previewUrl} alt="Fotografía de la INE ampliada" onCerrar={() => setAmpliada(false)} />}
        </div>
    );
}
