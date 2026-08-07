import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { Vehiculo } from './types';

interface EvidenciaFotografica {
    id: string;
    file: File;
    previewUrl: string;
}

interface Props {
    isOpen: boolean;
    vehiculo: Vehiculo | null;
    tipoAccion: 'Salida' | 'Entrada';
    onClose: () => void;
    onSubmit: (formData: FormData) => void | Promise<void>;
}

export const ModalMovimiento = ({
    isOpen,
    vehiculo,
    tipoAccion,
    onClose,
    onSubmit
}: Props) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [evidenciaError, setEvidenciaError] = useState('');
    const [evidencias, setEvidencias] = useState<EvidenciaFotografica[]>([]);
    const [retakeIndex, setRetakeIndex] = useState<number | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const evidenciasRef = useRef<EvidenciaFotografica[]>([]);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (!isCameraOpen) return;

        let cancelled = false;

        const startCamera = async () => {
            setCameraError('');

            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraError('Este navegador no permite abrir la cámara en vivo. Verifica que el sistema use HTTPS y tenga permiso para acceder a la cámara.');
                setIsCameraOpen(false);
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch {
                if (cancelled) return;

                setCameraError('No fue posible acceder a la cámara. Revisa los permisos del navegador e inténtalo nuevamente.');
                setIsCameraOpen(false);
            }
        };

        void startCamera();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [isCameraOpen, stopCamera]);

    const clearEvidence = useCallback(() => {
        setEvidencias((current) => {
            current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
            return [];
        });
        setRetakeIndex(null);
    }, []);

    useEffect(() => {
        evidenciasRef.current = evidencias;
    }, [evidencias]);

    useEffect(() => {
        setIsCameraOpen(false);
        setCameraError('');
        setEvidenciaError('');
        clearEvidence();
    }, [isOpen, tipoAccion, clearEvidence]);

    useEffect(() => {
        return () => {
            evidenciasRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        };
    }, []);

    if (!isOpen || !vehiculo) return null;

    const saveEvidence = (file: File) => {
        const newEvidence: EvidenciaFotografica = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        };

        setEvidencias((current) => {
            if (retakeIndex !== null && current[retakeIndex]) {
                const updated = [...current];
                URL.revokeObjectURL(updated[retakeIndex].previewUrl);
                updated[retakeIndex] = newEvidence;
                return updated;
            }

            return [...current, newEvidence];
        });

        setRetakeIndex(null);
        setEvidenciaError('');
        setCameraError('');
    };

    const handleTakePhoto = () => {
        const video = videoRef.current;

        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            setCameraError('Espera un momento a que la cámara termine de cargar.');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        if (!context) {
            setCameraError('No fue posible procesar la fotografía.');
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) {
                setCameraError('No fue posible guardar la fotografía. Inténtalo nuevamente.');
                return;
            }

            const file = new File(
                [blob],
                `evidencia-${tipoAccion.toLowerCase()}-${Date.now()}.jpg`,
                { type: 'image/jpeg' }
            );

            saveEvidence(file);
            setIsCameraOpen(false);
        }, 'image/jpeg', 0.85);
    };

    const handleRetakePhoto = (index: number) => {
        setRetakeIndex(index);
        setEvidenciaError('');
        setCameraError('');
        setIsCameraOpen(true);
    };

    const handleRemovePhoto = (index: number) => {
        setEvidencias((current) => {
            const evidenceToRemove = current[index];
            if (evidenceToRemove) URL.revokeObjectURL(evidenceToRemove.previewUrl);
            return current.filter((_, evidenceIndex) => evidenceIndex !== index);
        });
        setEvidenciaError('');
    };

    const handleCancelCamera = () => {
        setIsCameraOpen(false);
        setRetakeIndex(null);
        setCameraError('');
    };

    const handleClose = () => {
        setIsCameraOpen(false);
        stopCamera();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (evidencias.length === 0) {
            setEvidenciaError(`Debes tomar al menos una evidencia fotográfica de ${tipoAccion.toLowerCase()}.`);
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        evidencias.forEach(({ file }) => {
            formData.append('evidencias[]', file, file.name);
        });

        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputUppercase = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.target.value = e.target.value.toUpperCase();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[95vh] shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">

                <div
                    className={`p-6 flex justify-between items-center text-white ${
                        tipoAccion === 'Salida' ? 'bg-red-600' : 'bg-blue-600'
                    }`}
                >
                    <div>
                        <h3 className="text-xl font-bold italic tracking-tight">
                            REGISTRO DE {tipoAccion.toUpperCase()}
                        </h3>
                        <p className="text-sm opacity-90">{vehiculo.nombre}</p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="hover:bg-white/20 p-1 rounded-full transition-colors disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(95vh-100px)] overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Nombre del Chofer
                        </label>
                        <input
                            name="chofer"
                            type="text"
                            required
                            placeholder="NOMBRE COMPLETO"
                            onChange={handleInputUppercase}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Kilometraje
                            </label>
                            <input
                                name="kilometraje"
                                type="number"
                                required
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Gasolina
                            </label>
                            <select
                                name="gasolina"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="1/4">1/4</option>
                                <option value="1/2">1/2</option>
                                <option value="3/4">3/4</option>
                                <option value="LLENO">LLENO</option>
                            </select>
                        </div>
                    </div>

                    {tipoAccion === 'Salida' && (
                        <>
                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Destino
                                    </label>
                                    <input
                                        name="destino"
                                        type="text"
                                        required
                                        placeholder="¿A DÓNDE VA?"
                                        onChange={handleInputUppercase}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Autorizado por
                                    </label>
                                    <input
                                        name="autoriza"
                                        type="text"
                                        required
                                        placeholder="JEFE DE ÁREA"
                                        onChange={handleInputUppercase}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Matrícula
                                    </label>
                                    <input
                                        name="matricula"
                                        type="text"
                                        required
                                        placeholder="Escribe la matrícula…"
                                        onChange={handleInputUppercase}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        Motivo de la salida
                                    </label>
                                    <input
                                        name="motivo"
                                        type="text"
                                        required
                                        placeholder="Escribe el motivo"
                                        onChange={handleInputUppercase}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                    <div className="grid grid-cols-1 gap-4 border-t pt-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Notas
                            </label>
                            <textarea
                                name="notas"
                                onChange={handleInputUppercase}
                                placeholder=""
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-25 uppercase"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Evidencias fotográficas de {tipoAccion.toLowerCase()}
                                <span className="text-red-500"> *</span>
                            </label>
                            <p className="text-xs text-gray-400">
                                Toma una o varias fotografías donde se observe el estado actual del vehículo.
                            </p>
                        </div>

                        {isCameraOpen ? (
                            <div className="space-y-3">
                                <div className="relative overflow-hidden rounded-xl bg-black">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="h-64 w-full object-cover"
                                    />

                                    <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                                        {retakeIndex !== null
                                            ? `Repitiendo fotografía ${retakeIndex + 1}`
                                            : `Nueva fotografía ${evidencias.length + 1}`}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={handleCancelCamera}
                                        disabled={isSubmitting}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                                    >
                                        Cancelar cámara
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleTakePhoto}
                                        disabled={isSubmitting}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <Camera size={18} />
                                        Tomar fotografía
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`rounded-xl border-2 border-dashed p-4 text-center ${
                                    evidenciaError ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-gray-50'
                                }`}
                            >
                                <Camera className="mx-auto mb-2 text-gray-400" size={36} />
                                <p className="mb-3 text-sm text-gray-500">
                                    {evidencias.length === 0
                                        ? 'Aún no se ha tomado ninguna fotografía.'
                                        : 'Puedes capturar más fotografías del vehículo.'}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setRetakeIndex(null);
                                        setEvidenciaError('');
                                        setCameraError('');
                                        setIsCameraOpen(true);
                                    }}
                                    disabled={isSubmitting}
                                    className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    <Camera size={18} />
                                    {evidencias.length === 0 ? 'Encender cámara' : 'Agregar otra fotografía'}
                                </button>
                            </div>
                        )}

                        {evidencias.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-gray-600">Fotografías capturadas</p>
                                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                        {evidencias.length} {evidencias.length === 1 ? 'foto' : 'fotos'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {evidencias.map((evidence, index) => (
                                        <div
                                            key={evidence.id}
                                            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                                        >
                                            <div className="relative">
                                                <img
                                                    src={evidence.previewUrl}
                                                    alt={`Evidencia ${index + 1} de ${tipoAccion.toLowerCase()}`}
                                                    className="h-40 w-full bg-slate-950 object-contain"
                                                />
                                                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white">
                                                    Foto {index + 1}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 p-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRetakePhoto(index)}
                                                    disabled={isSubmitting || isCameraOpen}
                                                    className="flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    <RefreshCw size={15} />
                                                    Repetir
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(index)}
                                                    disabled={isSubmitting || isCameraOpen}
                                                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {cameraError && (
                            <p className="text-sm font-medium text-amber-700" role="alert">
                                {cameraError}
                            </p>
                        )}

                        {evidenciaError && (
                            <p className="text-sm font-medium text-red-600" role="alert">
                                {evidenciaError}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-gray-500 font-semibold hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                                isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : (tipoAccion === 'Salida' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700 active:scale-95')
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    PROCESANDO...
                                </>
                            ) : (
                                `REGISTRAR ${tipoAccion.toUpperCase()}`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
