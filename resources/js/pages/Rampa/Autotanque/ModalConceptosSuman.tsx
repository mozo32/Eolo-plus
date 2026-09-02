import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    PlusCircle,
    X,
    Fuel,
    Camera,
    Trash2,
    Ruler,
    RefreshCw,
} from 'lucide-react';

import { TABLA_CALIBRACION } from './tablaCalibracion';

interface EvidenciaFotografica {
    id: string;
    file: File;
    previewUrl: string;
}

interface ConceptosSumanProps {
    onAdd: (data: {
        litros: number;
        remision: string;
        evidencias: File[];
        tomaFisicaCm: number | null;
        tomaFisicaLitros: number | null;
    }) => void;
    onClose: () => void;
}

export const ModalConceptosSuman = ({
    onAdd,
    onClose,
}: ConceptosSumanProps) => {
    const [litros, setLitros] = useState<number | ''>('');
    const [remision, setRemision] = useState('');
    const [tomaFisicaCm, setTomaFisicaCm] = useState<number | ''>('');
    const [tomaFisicaLitros, setTomaFisicaLitros] = useState<number | ''>('');
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
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
                setCameraError(
                    'Este navegador no permite abrir la cámara en vivo. Verifica que el sistema use HTTPS y tenga permiso para acceder a la cámara.',
                );
                setIsCameraOpen(false);
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: {
                            ideal: 'environment',
                        },
                    },
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

                setCameraError(
                    'No fue posible acceder a la cámara. Revisa los permisos del navegador e inténtalo nuevamente.',
                );
                setIsCameraOpen(false);
            }
        };

        void startCamera();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [isCameraOpen, stopCamera]);

    useEffect(() => {
        evidenciasRef.current = evidencias;
    }, [evidencias]);

    useEffect(() => {
        return () => {
            stopCamera();

            evidenciasRef.current.forEach(({ previewUrl }) =>
                URL.revokeObjectURL(previewUrl),
            );
        };
    }, [stopCamera]);

    const handleCmChange = (value: string) => {
        if (value === '') {
            setTomaFisicaCm('');
            setTomaFisicaLitros('');
            return;
        }

        const cm = Number(value);

        if (Number.isNaN(cm)) return;

        setTomaFisicaCm(cm);

        const centimetroEntero = Math.round(cm);
        const litrosEncontrados = TABLA_CALIBRACION[centimetroEntero];

        if (litrosEncontrados !== undefined) {
            setTomaFisicaLitros(litrosEncontrados);
        } else {
            setTomaFisicaLitros('');
        }
    };

    const saveEvidence = (file: File) => {
        const newEvidence: EvidenciaFotografica = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        };

        setEvidencias((current) => {
            if (retakeIndex !== null && current[retakeIndex]) {
                const updated = [...current];

                URL.revokeObjectURL(
                    updated[retakeIndex].previewUrl,
                );

                updated[retakeIndex] = newEvidence;

                return updated;
            }

            return [...current, newEvidence];
        });

        setRetakeIndex(null);
        setCameraError('');
    };

    const handleTakePhoto = () => {
        const video = videoRef.current;

        if (
            !video ||
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
            setCameraError(
                'Espera un momento a que la cámara termine de cargar.',
            );
            return;
        }

        const canvas = document.createElement('canvas');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');

        if (!context) {
            setCameraError(
                'No fue posible procesar la fotografía.',
            );
            return;
        }

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    setCameraError(
                        'No fue posible guardar la fotografía. Inténtalo nuevamente.',
                    );
                    return;
                }

                const file = new File(
                    [blob],
                    `evidencia-concepto-${Date.now()}.jpg`,
                    {
                        type: 'image/jpeg',
                    },
                );

                saveEvidence(file);
                setIsCameraOpen(false);
            },
            'image/jpeg',
            0.85,
        );
    };

    const handleRetakePhoto = (index: number) => {
        setRetakeIndex(index);
        setCameraError('');
        setIsCameraOpen(true);
    };

    const handleRemovePhoto = (index: number) => {
        setEvidencias((current) => {
            const evidenceToRemove = current[index];

            if (evidenceToRemove) {
                URL.revokeObjectURL(
                    evidenceToRemove.previewUrl,
                );
            }

            return current.filter(
                (_, evidenceIndex) => evidenceIndex !== index,
            );
        });
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

    const handleConfirmar = () => {
        if (!litros || !remision.trim()) return;

        stopCamera();

        onAdd({
            litros: Number(litros),
            remision: remision.trim(),
            evidencias: evidencias.map(({ file }) => file),
            tomaFisicaCm:
                tomaFisicaCm === ''
                    ? null
                    : Number(tomaFisicaCm),
            tomaFisicaLitros:
                tomaFisicaLitros === ''
                    ? null
                    : Number(tomaFisicaLitros),
        });

        onClose();
    };

    const tomaFisicaFueraDeRango =
        tomaFisicaCm !== '' &&
        (
            Number(tomaFisicaCm) < 0 ||
            Number(tomaFisicaCm) > 138
        );

    return (
        <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-green-700">
                    <PlusCircle size={20} />
                    Conceptos que Suman
                </h2>

                <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 transition hover:text-red-500"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        Litros comprados a ASA
                    </label>

                    <div className="relative">
                        <Fuel
                            className="absolute left-3 top-2.5 text-gray-400"
                            size={18}
                        />

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full rounded-lg border py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-green-500"
                            value={litros}
                            onChange={(e) =>
                                setLitros(
                                    e.target.value === ''
                                        ? ''
                                        : Number(e.target.value),
                                )
                            }
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        N. Remisión / Factura
                    </label>

                    <input
                        type="text"
                        placeholder="Ej. ASA-9988"
                        className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-green-500"
                        value={remision}
                        onChange={(e) =>
                            setRemision(e.target.value)
                        }
                    />
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <Ruler size={18} />
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-800">
                                Toma Física
                                <span className="ml-1 text-xs font-normal text-gray-400">
                                    (Opcional)
                                </span>
                            </h3>

                            <p className="text-xs text-gray-500">
                                Nivel físico actual del tanque
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                                Centímetros (cm)
                            </label>

                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="138"
                                    step="1"
                                    placeholder="Ej. 75"
                                    value={tomaFisicaCm}
                                    onChange={(e) =>
                                        handleCmChange(
                                            e.target.value,
                                        )
                                    }
                                    className={`w-full rounded-lg border bg-white px-4 py-2 pr-12 outline-none focus:ring-2 ${
                                        tomaFisicaFueraDeRango
                                            ? 'border-red-400 focus:ring-red-400'
                                            : 'focus:ring-blue-500'
                                    }`}
                                />

                                <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">
                                    cm
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                                Litros
                            </label>

                            <div className="relative">
                                <Fuel
                                    size={17}
                                    className="absolute left-3 top-2.5 text-blue-500"
                                />

                                <input
                                    type="number"
                                    readOnly
                                    value={tomaFisicaLitros}
                                    placeholder="0"
                                    className="w-full cursor-not-allowed rounded-lg border border-blue-200 bg-blue-100/50 py-2 pl-10 pr-14 font-bold text-blue-700 outline-none"
                                />

                                <span className="absolute right-3 top-2.5 text-xs font-bold text-blue-500">
                                    L
                                </span>
                            </div>
                        </div>
                    </div>

                    {tomaFisicaFueraDeRango && (
                        <p className="mt-2 text-xs font-medium text-red-500">
                            La tabla de calibración solamente contempla valores entre 0 y 138 cm.
                        </p>
                    )}

                    {tomaFisicaCm !== '' &&
                        tomaFisicaLitros !== '' &&
                        !tomaFisicaFueraDeRango && (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-gray-600">
                                Una medición de{' '}
                                <strong>
                                    {tomaFisicaCm} cm
                                </strong>{' '}
                                corresponde a{' '}
                                <strong className="text-blue-700">
                                    {Number(
                                        tomaFisicaLitros,
                                    ).toLocaleString('es-MX')}{' '}
                                    litros
                                </strong>
                                .
                            </div>
                        )}
                </div>

                <div className="space-y-3 border-t pt-4">
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                            Evidencias fotográficas
                            <span className="ml-1 font-normal normal-case text-gray-400">
                                (Opcional)
                            </span>
                        </label>

                        <p className="text-xs text-gray-400">
                            Puedes tomar una o varias fotografías como evidencia.
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
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar cámara
                                </button>

                                <button
                                    type="button"
                                    onClick={handleTakePhoto}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
                                >
                                    <Camera size={18} />
                                    Tomar fotografía
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                            <Camera
                                className="mx-auto mb-2 text-gray-400"
                                size={36}
                            />

                            <p className="mb-3 text-sm text-gray-500">
                                {evidencias.length === 0
                                    ? 'Aún no se ha tomado ninguna fotografía.'
                                    : 'Puedes capturar más fotografías.'}
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setRetakeIndex(null);
                                    setCameraError('');
                                    setIsCameraOpen(true);
                                }}
                                className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-700"
                            >
                                <Camera size={18} />

                                {evidencias.length === 0
                                    ? 'Encender cámara'
                                    : 'Agregar otra fotografía'}
                            </button>
                        </div>
                    )}

                    {evidencias.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-gray-600">
                                    Fotografías capturadas
                                </p>

                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                                    {evidencias.length}{' '}
                                    {evidencias.length === 1
                                        ? 'foto'
                                        : 'fotos'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {evidencias.map(
                                    (evidence, index) => (
                                        <div
                                            key={evidence.id}
                                            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                                        >
                                            <div className="relative">
                                                <img
                                                    src={evidence.previewUrl}
                                                    alt={`Evidencia ${index + 1}`}
                                                    className="h-40 w-full bg-slate-950 object-contain"
                                                />

                                                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white">
                                                    Foto {index + 1}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 p-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRetakePhoto(index)
                                                    }
                                                    disabled={isCameraOpen}
                                                    className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    <RefreshCw size={15} />
                                                    Repetir
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemovePhoto(index)
                                                    }
                                                    disabled={isCameraOpen}
                                                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    )}

                    {cameraError && (
                        <p className="text-sm font-medium text-amber-700">
                            {cameraError}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleConfirmar}
                    disabled={!litros || !remision.trim()}
                    className="mt-4 w-full rounded-lg bg-green-600 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    AGREGAR AL BALANCE
                </button>
            </div>
        </div>
    );
};
