import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Video, Trash2, AlertTriangle, Info, Image as ImageIcon } from 'lucide-react';
import { apiValidarColor, apiAprenderColor } from '@/stores/apiInspeccionCombustible';

interface FotoData {
    file: string;
    observacion: string;
    alertaRosa: boolean;
    debug?: {
        h: number;
        s: number;
        rgb: string;
    };
}

interface Props {
    fotosGuardadas: FotoData[];
    onSave: (fotos: FotoData[]) => void;
    detectarColor?: boolean;
    tipoInspeccion?: 'HYDROKIT' | 'SHELL';
}

export const CameraModulo = ({
    fotosGuardadas,
    onSave,
    detectarColor = false,
    tipoInspeccion = 'HYDROKIT'
}: Props) => {
    const [fotos, setFotos] = useState<FotoData[]>(fotosGuardadas);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cargando, setCargando] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        setFotos(fotosGuardadas);
    }, [fotosGuardadas]);

    useEffect(() => {
        if (isCameraActive) startCamera();
        else stopCamera();
        return () => stopCamera();
    }, [isCameraActive]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err) {
            setIsCameraActive(false);
            alert("Acceso a cámara denegado.");
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const capturarFoto = async () => {
        const video = videoRef.current;
        if (!video || !isCameraActive || cargando) return;

        setCargando(true);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setCargando(false);
            return;
        }

        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');

        let resultadoApi = { alerta: false, msg: "", debug: undefined };

        if (detectarColor) {
            try {
                const respuesta = await apiValidarColor(base64, tipoInspeccion);
                resultadoApi = {
                    alerta: respuesta.alerta,
                    msg: respuesta.mensaje || respuesta.msg || "",
                    debug: respuesta.debug
                };
            } catch (error) {
                console.error(error);
                resultadoApi.msg = "Error de validación";
            }
        }

        const nuevas = [...fotos, {
            file: base64,
            observacion: resultadoApi.msg,
            alertaRosa: resultadoApi.alerta,
            debug: resultadoApi.debug
        }];

        setFotos(nuevas);
        onSave(nuevas);
        setCargando(false);
    };

    const eliminarFoto = (index: number) => {
        const filtradas = fotos.filter((_, i) => i !== index);
        setFotos(filtradas);
        onSave(filtradas);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/2 space-y-4">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <span className="flex items-center gap-2 font-bold text-slate-700">
                            <div className={`w-3 h-3 rounded-full ${isCameraActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            VISOR EN VIVO
                        </span>
                        <button
                            onClick={() => setIsCameraActive(!isCameraActive)}
                            className={`px-6 py-2 rounded-xl font-bold transition-all ${isCameraActive ? 'bg-red-100 text-red-600' : 'bg-green-600 text-white'}`}
                        >
                            {isCameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
                        </button>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border-4 border-white shadow-2xl">
                        {isCameraActive ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                {detectarColor && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-24 h-48 border-2 border-dashed border-white/40 rounded-full flex items-center justify-center">
                                            <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_15px_red]" />
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={capturarFoto}
                                    disabled={cargando}
                                    className={`absolute bottom-6 left-1/2 -translate-x-1/2 p-1 rounded-full border-2 border-white transition-all ${cargando ? 'opacity-50 cursor-not-allowed' : 'bg-white/20 backdrop-blur-md hover:scale-110 active:scale-95'}`}
                                >
                                    <div className="w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center">
                                        {cargando ? (
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <div className="w-12 h-12 border-2 border-slate-200 rounded-full" />
                                        )}
                                    </div>
                                </button>
                            </>
                        ) : (
                            <div className="text-slate-500 flex flex-col items-center gap-3">
                                <Video size={60} className="opacity-10" />
                                <p className="font-medium text-xs uppercase tracking-widest">Cámara Desactivada</p>
                            </div>
                        )}
                    </div>
                    {detectarColor && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 italic">
                            <Info size={12} />
                            Validación automática vía servidor activa.
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full lg:w-1/2">
                <h3 className="font-bold text-slate-700 mb-4 px-2 uppercase tracking-tighter flex items-center gap-2">
                    <ImageIcon size={18} className="text-blue-500" />
                    Evidencias ({fotos.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto p-2">
                    {fotos.map((f, i) => (
                        <div key={i} className={`group relative bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${f.alertaRosa ? 'border-red-500 border-2 ring-4 ring-red-50' : 'border-slate-200'}`}>
                            <button
                                onClick={() => eliminarFoto(i)}
                                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg z-30 shadow-lg active:scale-90 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>

                            <div className="h-40 overflow-hidden bg-slate-100 border-b border-slate-100">
                                <img
                                    src={f.file}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                    alt={`Captura ${i + 1}`}
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagen+no+disponible'; }}
                                />
                            </div>

                            <div className="p-3 bg-white space-y-2">
                                <textarea
                                    className="w-full p-2 text-xs border-none rounded-lg bg-slate-50 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none resize-none"
                                    rows={2}
                                    placeholder="Agregar observación..."
                                    value={f.observacion}
                                    onChange={(e) => {
                                        const nuevas = [...fotos];
                                        nuevas[i].observacion = e.target.value;
                                        setFotos(nuevas);
                                        onSave(nuevas);
                                    }}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    {f.alertaRosa ? (
                                        <p className="text-[9px] text-red-600 font-bold uppercase flex items-center gap-1">
                                            <AlertTriangle size={10} /> Anomalía detectada
                                        </p>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                const nuevas = [...fotos];
                                                nuevas[i].alertaRosa = true;
                                                nuevas[i].observacion = "MARCADO MANUALMENTE: NO CONFORME";
                                                setFotos(nuevas);
                                                onSave(nuevas);

                                                if (f.debug?.h) {
                                                    try {
                                                        await apiAprenderColor(f.debug.h, tipoInspeccion);
                                                    } catch (e) { console.error("No se pudo guardar aprendizaje"); }
                                                }
                                            }}
                                            className="text-[9px] bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 px-2 py-1 rounded-md font-bold transition-colors uppercase"
                                        >
                                            ¿No detectó? Marcar error
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
