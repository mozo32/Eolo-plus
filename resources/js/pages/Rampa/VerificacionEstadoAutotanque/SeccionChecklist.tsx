import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Circle } from 'lucide-react';

interface Props {
    secciones: any[];
    respuestas: Record<string, string>;
    onToggle: (item: string, valor: 'Ok' | 'No') => void;
    fotos: File[];
    setFotos: React.Dispatch<React.SetStateAction<File[]>>;
    previews: string[];
    setPreviews: React.Dispatch<React.SetStateAction<string[]>>;
}

export const SeccionChecklist = ({ secciones, respuestas, onToggle, fotos, setFotos, previews, setPreviews }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [camaraActiva, setCamaraActiva] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Efecto para asignar el stream al elemento video en cuanto este se renderice
    useEffect(() => {
        if (camaraActiva && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => console.error("Error al reproducir video:", err));
        }
    }, [camaraActiva, stream]);

    const encenderCamara = async () => {
        setError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            setStream(mediaStream);
            setCamaraActiva(true);
        } catch (err) {
            setError("No se pudo acceder a la cámara. Verifica los permisos.");
            console.error(err);
        }
    };

    const apagarCamara = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCamaraActiva(false);
    };

    const capturarFoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Usamos las dimensiones reales del video capturado
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPreviews(prev => [...prev, dataUrl]);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `evidencia_${Date.now()}.jpg`, { type: 'image/jpeg' });
                        setFotos(prev => [...prev, file]);
                    }
                }, 'image/jpeg', 0.8);
            }
        }
    };

    const eliminarFoto = (index: number) => {
        setFotos(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [stream]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {secciones.map((seccion, sIdx) => (
                <div key={sIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <h2 className="bg-gray-50 px-4 py-2 text-blue-800 font-bold text-xs uppercase border-b">{seccion.titulo}</h2>
                    <div className="divide-y divide-gray-50">
                        {seccion.items.map((item: string, iIdx: number) => (
                            <div key={iIdx} className="flex items-center justify-between p-4">
                                <span className="text-sm text-gray-600 font-medium">{item}</span>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button type="button" onClick={() => onToggle(item, 'Ok')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${respuestas[item] === 'Ok' ? 'bg-green-500 text-white' : 'text-gray-400'}`}>OK</button>
                                    <button type="button" onClick={() => onToggle(item, 'No')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${respuestas[item] === 'No' ? 'bg-red-500 text-white' : 'text-gray-400'}`}>NO</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Camera size={18} className="text-blue-600" />
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Cámara de Inspección</span>
                    </div>
                    {camaraActiva && (
                        <button type="button" onClick={apagarCamara} className="text-[10px] font-bold text-red-500 uppercase px-2 py-1 bg-red-50 rounded-lg">Cerrar</button>
                    )}
                </div>

                <div className="p-4">
                    {!camaraActiva ? (
                        <button
                            type="button"
                            onClick={encenderCamara}
                            className="w-full py-10 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center gap-3 text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <Camera size={40} strokeWidth={1.5} />
                            <span className="text-xs font-black uppercase tracking-widest">Activar Visor de Cámara</span>
                        </button>
                    ) : (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] shadow-2xl">
                            {/* IMPORTANTE: muted, playsInline y autoPlay son vitales para móviles */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]" // scale-x-[-1] es opcional, lo voltea tipo espejo
                            />

                            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center">
                                <button
                                    type="button"
                                    onClick={capturarFoto}
                                    className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
                                >
                                    <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-900"></div>
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-red-500 text-[10px] mt-2 font-bold text-center">{error}</p>}

                    {previews.length > 0 && (
                        <div className="mt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Fotos ({fotos.length})</p>
                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                {previews.map((src, index) => (
                                    <div key={index} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-md">
                                        <img src={src} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => eliminarFoto(index)}
                                            className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 backdrop-blur-sm"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};
