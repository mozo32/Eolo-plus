import React, { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

interface Props {
    secciones: any[];
    itemsCombustible: string[];
    totalDrenes: number;
    respuestas: Record<string, string>;
    onToggle: (item: string, valor: string) => void;
    fotos: File[];
    setFotos: React.Dispatch<React.SetStateAction<File[]>>;
    previews: string[];
    setPreviews: React.Dispatch<React.SetStateAction<string[]>>;
}

const NOMBRES_DRENES: Record<number, string> = {
    1: "Delantero del tanque",
    2: "Strainer",
    3: "Succión auxiliar",
    4: "Trasero del tanque",
    5: "Entrada a elementos filtrantes",
    6: "Salida de elementos filtrantes"
};

const normalizar = (texto: string) =>
    texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

const obtenerSeleccion = (valor?: string) => {
    if (!valor) return [];
    return valor.split(" | ").map(v => v.trim()).filter(Boolean);
};

export const SeccionChecklist = ({
    secciones,
    itemsCombustible,
    totalDrenes,
    respuestas,
    onToggle,
    fotos,
    setFotos,
    previews,
    setPreviews
}: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [camaraActiva, setCamaraActiva] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drenActivo, setDrenActivo] = useState(1);

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
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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
        const previewAEliminar = previews[index];

        if (previewAEliminar.startsWith('data:') || previewAEliminar.startsWith('blob:')) {
            setFotos(prev => prev.filter((_, i) => i !== index));
        }

        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [stream]);

    const esDrenCompleto = (numDren: number) => {
        const nombreDren = NOMBRES_DRENES[numDren] || `${numDren}`;
        return itemsCombustible.every(item => respuestas[`${item} - Dren ${nombreDren.toLowerCase()}`]);
    };

    const esPruebaClaridad = (item: string) => {
        const texto = normalizar(item);
        return texto.includes("claridad") && texto.includes("brillantez");
    };

    const esPruebaSolidosAgua = (item: string) => {
        const texto = normalizar(item);
        return texto.includes("presencia") && texto.includes("solidos") && texto.includes("agua");
    };

    const actualizarSeleccionMultiple = (
        llave: string,
        opcion: string,
        opcionesExclusivas: string[],
        opcionesMultiples: string[]
    ) => {
        const actuales = obtenerSeleccion(respuestas[llave]);

        if (opcionesExclusivas.includes(opcion)) {
            if (actuales.includes(opcion)) {
                onToggle(llave, "");
            } else {
                onToggle(llave, opcion);
            }
            return;
        }

        let nuevas = actuales.filter(valor => !opcionesExclusivas.includes(valor));

        if (nuevas.includes(opcion)) {
            nuevas = nuevas.filter(valor => valor !== opcion);
        } else {
            nuevas = [...nuevas, opcion];
        }

        nuevas = nuevas.filter(valor => opcionesMultiples.includes(valor));

        onToggle(llave, nuevas.join(" | "));
    };

    const BotonOpcion = ({
        activo,
        texto,
        onClick,
        tipo
    }: {
        activo: boolean;
        texto: string;
        onClick: () => void;
        tipo: "positivo" | "negativo";
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-[11px] font-black transition-all whitespace-nowrap ${
                activo
                    ? tipo === "positivo"
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                    : "text-gray-400 hover:text-gray-600"
            }`}
        >
            {texto}
        </button>
    );

    const renderOpcionesCalidad = (item: string, llaveUnica: string) => {
        const seleccionadas = obtenerSeleccion(respuestas[llaveUnica]);

        if (esPruebaClaridad(item)) {
            const claroBrillante = "Claro y brillante";
            const noClaro = "No claro";
            const noBrillante = "No brillante";

            return (
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1 flex-wrap justify-end">
                    <BotonOpcion
                        texto={claroBrillante}
                        tipo="positivo"
                        activo={seleccionadas.includes(claroBrillante)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                claroBrillante,
                                [claroBrillante],
                                [noClaro, noBrillante]
                            )
                        }
                    />

                    <BotonOpcion
                        texto={noClaro}
                        tipo="negativo"
                        activo={seleccionadas.includes(noClaro)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                noClaro,
                                [claroBrillante],
                                [noClaro, noBrillante]
                            )
                        }
                    />

                    <BotonOpcion
                        texto={noBrillante}
                        tipo="negativo"
                        activo={seleccionadas.includes(noBrillante)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                noBrillante,
                                [claroBrillante],
                                [noClaro, noBrillante]
                            )
                        }
                    />
                </div>
            );
        }

        if (esPruebaSolidosAgua(item)) {
            const sinPresencia = "Sin presencia de sólidos y/o agua de forma visual";
            const conSolidos = "Con presencia de sólidos";
            const conAgua = "Con presencia de agua";

            return (
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1 flex-wrap justify-end">
                    <BotonOpcion
                        texto="Sin presencia"
                        tipo="positivo"
                        activo={seleccionadas.includes(sinPresencia)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                sinPresencia,
                                [sinPresencia],
                                [conSolidos, conAgua]
                            )
                        }
                    />

                    <BotonOpcion
                        texto={conSolidos}
                        tipo="negativo"
                        activo={seleccionadas.includes(conSolidos)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                conSolidos,
                                [sinPresencia],
                                [conSolidos, conAgua]
                            )
                        }
                    />

                    <BotonOpcion
                        texto={conAgua}
                        tipo="negativo"
                        activo={seleccionadas.includes(conAgua)}
                        onClick={() =>
                            actualizarSeleccionMultiple(
                                llaveUnica,
                                conAgua,
                                [sinPresencia],
                                [conSolidos, conAgua]
                            )
                        }
                    />
                </div>
            );
        }

        return (
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                    type="button"
                    onClick={() => onToggle(llaveUnica, 'Ok')}
                    className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${
                        respuestas[llaveUnica] === 'Ok'
                            ? 'bg-green-500 text-white'
                            : 'text-gray-400'
                    }`}
                >
                    OK
                </button>

                <button
                    type="button"
                    onClick={() => onToggle(llaveUnica, 'No')}
                    className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${
                        respuestas[llaveUnica] === 'No'
                            ? 'bg-red-500 text-white'
                            : 'text-gray-400'
                    }`}
                >
                    NO
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {secciones.map((seccion, sIdx) => (
                <div key={sIdx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <h2 className="bg-gray-50 px-4 py-2 text-blue-800 font-bold text-xs uppercase border-b">
                        {seccion.titulo}
                    </h2>

                    <div className="divide-y divide-gray-50">
                        {seccion.items.map((item: string, iIdx: number) => (
                            <div key={iIdx} className="flex items-center justify-between p-4">
                                <span className="text-sm text-gray-600 font-medium">{item}</span>

                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        type="button"
                                        onClick={() => onToggle(item, 'Ok')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${
                                            respuestas[item] === 'Ok'
                                                ? 'bg-green-500 text-white'
                                                : 'text-gray-400'
                                        }`}
                                    >
                                        OK
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onToggle(item, 'No')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${
                                            respuestas[item] === 'No'
                                                ? 'bg-red-500 text-white'
                                                : 'text-gray-400'
                                        }`}
                                    >
                                        NO
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <h2 className="bg-gray-50 px-4 py-2 text-blue-800 font-bold text-xs uppercase border-b">
                    Pruebas de Calidad de Combustible
                </h2>

                <div className="flex border-b overflow-x-auto bg-slate-50/50 p-2 gap-1.5 custom-scrollbar">
                    {Array.from({ length: totalDrenes }, (_, i) => i + 1).map((num) => {
                        const activo = drenActivo === num;
                        const completo = esDrenCompleto(num);
                        const nombreDren = NOMBRES_DRENES[num] || `Dren ${num}`;

                        return (
                            <button
                                key={num}
                                type="button"
                                onClick={() => setDrenActivo(num)}
                                className={`flex-1 min-w-[110px] py-2 px-2 rounded-lg transition-all flex flex-col items-center justify-center gap-1 border ${
                                    activo
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                    {completo && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-white' : 'bg-green-500'}`} />
                                    )}
                                    DREN {num}
                                </div>

                                <span className={`text-[9px] text-center leading-tight truncate w-full ${
                                    activo ? 'text-blue-100' : 'text-slate-400'
                                }`}>
                                    {nombreDren}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="divide-y divide-gray-50 bg-white">
                    {itemsCombustible.map((item: string, idx: number) => {
                        const nombreDrenActual = NOMBRES_DRENES[drenActivo] || `${drenActivo}`;
                        const llaveUnica = `${item} - Dren ${nombreDrenActual.toLowerCase()}`;

                        return (
                            <div
                                key={idx}
                                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex flex-col">
                                    <span className="text-sm text-gray-600 font-medium">{item}</span>
                                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                                        Evaluando Dren {drenActivo}: {nombreDrenActual}
                                    </span>
                                </div>

                                {renderOpcionesCalidad(item, llaveUnica)}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <Camera size={18} className="text-blue-600" />
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                            Cámara de Inspección
                        </span>
                    </div>

                    {camaraActiva && (
                        <button
                            type="button"
                            onClick={apagarCamara}
                            className="text-[10px] font-bold text-red-500 uppercase px-2 py-1 bg-red-50 rounded-lg"
                        >
                            Cerrar
                        </button>
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
                            <span className="text-xs font-black uppercase tracking-widest">
                                Activar Visor de Cámara
                            </span>
                        </button>
                    ) : (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] shadow-2xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]"
                            />

                            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center">
                                <button
                                    type="button"
                                    onClick={capturarFoto}
                                    className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
                                >
                                    <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-900" />
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="text-red-500 text-[10px] mt-2 font-bold text-center">
                            {error}
                        </p>
                    )}

                    {previews.length > 0 && (
                        <div className="mt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">
                                Fotos ({fotos.length})
                            </p>

                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                {previews.map((src, index) => (
                                    <div
                                        key={index}
                                        className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-md"
                                    >
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
