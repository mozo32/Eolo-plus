import React, { useEffect, useRef, useState } from "react";

export type FotoItem =
    | { kind: "existing"; id: number; url: string; status?: "A" | "N" }
    | { kind: "new"; dataUrl: string };

interface EvidenciFotograficaProps {
    value: FotoItem[];
    onChange: (fotos: FotoItem[]) => void;
}
const compressCanvasImage = (
    canvas: HTMLCanvasElement,
    maxWidth = 640,
    quality = 0.35
): string => {
    const ratio = canvas.width / canvas.height;

    let targetWidth = canvas.width;
    let targetHeight = canvas.height;

    if (canvas.width > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = Math.round(maxWidth / ratio);
    }

    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;

    const ctx = resizedCanvas.getContext("2d")!;

    // 🔥 Fondo blanco (evita basura visual)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    return resizedCanvas.toDataURL("image/jpeg", quality);
};

const EvidenciFotografica: React.FC<EvidenciFotograficaProps> = ({
    value,
    onChange,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* ======================
       Fotos visibles
    ====================== */

    const visibles = value.filter(
        (f) => !(f.kind === "existing" && (f.status ?? "A") === "N")
    );

    const count = visibles.length;

    /* ======================
       Abrir modal
    ====================== */

    const startCamera = () => {
        setError(null);
        setIsModalOpen(true);
    };

    /* ======================
       Iniciar cámara cuando el modal existe
    ====================== */

    useEffect(() => {
        if (!isModalOpen) return;

        const startStream = async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    setError("Este navegador no soporta acceso a la cámara.");
                    setIsModalOpen(false);
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                    },
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                streamRef.current = stream;
            } catch (err) {
                console.error(err);
                setError("No se pudo acceder a la cámara.");
                setIsModalOpen(false);
            }
        };

        startStream();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
    }, [isModalOpen]);

    /* ======================
       Cerrar cámara
    ====================== */

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setIsModalOpen(false);
    };

    /* ======================
       Tomar foto
    ====================== */

    const handleTakePhoto = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement("canvas");

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const optimizedDataUrl = compressCanvasImage(
            canvas,
            640,  // 🔥 clave
            0.35  // 🔥 clave
        );

        onChange([...value, { kind: "new", dataUrl: optimizedDataUrl }]);

        stopCamera();
    };

    /* ======================
       Quitar foto
    ====================== */

    const handleRemovePhoto = (indexVisible: number) => {
        const fotoVisible = visibles[indexVisible];
        if (!fotoVisible) return;

        const idxReal = value.findIndex((f) => f === fotoVisible);
        if (idxReal === -1) return;

        const next = [...value];
        const foto = next[idxReal];

        if (foto.kind === "existing") {
            next[idxReal] = { ...foto, status: "N" };
        } else {
            next.splice(idxReal, 1);
        }

        onChange(next);
    };

    /* ======================
       Render
    ====================== */

    return (
        <div className="mt-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-800">
                <div>
                    <h4 className="text-sm font-semibold">Evidencia fotográfica</h4>
                    <p className="text-xs text-gray-500">
                        {count} fotografía{count !== 1 && "s"}
                    </p>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Libre
                </span>
            </div>

            {/* Botón principal */}
            <button
                type="button"
                onClick={startCamera}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
                📷 Tomar fotografíassss
            </button>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Lista accesible */}
            {visibles.length > 0 && (
                <div className="space-y-2">
                    {visibles.map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                        >
                            <span>Foto {i + 1}</span>

                            <button
                                type="button"
                                onClick={() => handleRemovePhoto(i)}
                                className="text-xs font-semibold text-red-600"
                            >
                                Quitar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ======================
               MODAL CÁMARA
            ====================== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="w-full max-w-md rounded-xl bg-white p-4 dark:bg-gray-900">
                        <h3 className="mb-3 text-sm font-semibold">
                            Capturar fotografía
                        </h3>

                        <div className="overflow-hidden rounded-lg bg-black">
                            <video
                                ref={videoRef}
                                className="h-64 w-full object-contain"
                                autoPlay
                                playsInline
                                muted
                            />
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="rounded-lg bg-gray-300 px-4 py-2 text-sm dark:bg-gray-700"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleTakePhoto}
                                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white"
                            >
                                📸 Tomar foto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvidenciFotografica;
