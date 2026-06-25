import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Trash2, CheckCircle2, User, Save, X } from 'lucide-react';
import { usePage } from '@inertiajs/react';

interface Props {
    data: any;
    onChange: (d: any) => void;
}

const SignaturePad = ({
    onSave,
    onClear,
    onNameChange,
    nameValue,
    signatureValue,
    title
}: {
    onSave: (blob: string) => void,
    onClear: () => void,
    onNameChange: (name: string) => void,
    nameValue: string,
    signatureValue: string | null,
    title: string
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [openModal, setOpenModal] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);
    const [tempSignature, setTempSignature] = useState<string | null>(null);

    const prepararCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
    };

    useEffect(() => {
        if (!openModal) return;

        const timer = setTimeout(() => {
            prepararCanvas();
        }, 50);

        const resize = () => prepararCanvas();

        window.addEventListener('resize', resize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', resize);
        };
    }, [openModal]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        const clientX = 'touches' in e
            ? e.touches[0].clientX
            : (e as React.MouseEvent).clientX;

        const clientY = 'touches' in e
            ? e.touches[0].clientY
            : (e as React.MouseEvent).clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) e.preventDefault();

        setIsDrawing(true);
        setHasDrawing(true);

        const { x, y } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');

        ctx?.beginPath();
        ctx?.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        if ('touches' in e) e.preventDefault();

        const { x, y } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');

        ctx?.lineTo(x, y);
        ctx?.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;

        setIsDrawing(false);

        const canvas = canvasRef.current;
        if (!canvas) return;

        setTempSignature(canvas.toDataURL('image/png'));
    };

    const limpiarCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setTempSignature(null);
        setHasDrawing(false);
    };

    const abrirModalFirma = () => {
        if (signatureValue) {
            const confirmar = window.confirm('¿Está seguro de cambiar la firma?');

            if (!confirmar) return;
        }

        setTempSignature(null);
        setHasDrawing(false);
        setOpenModal(true);
    };

    const guardarFirma = () => {
        if (!tempSignature) {
            alert('Primero debe colocar una firma.');
            return;
        }

        onSave(tempSignature);
        setOpenModal(false);
    };

    const eliminarFirma = () => {
        if (signatureValue) {
            const confirmar = window.confirm('¿Está seguro de eliminar esta firma?');

            if (!confirmar) return;
        }

        onClear();
        setTempSignature(null);
        setHasDrawing(false);
    };

    return (
        <>
            <div className="flex flex-col gap-4 bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm transition-all hover:border-slate-200">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 tracking-widest">
                        {title}
                    </span>

                    {signatureValue && (
                        <button
                            type="button"
                            onClick={eliminarFirma}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-32 relative overflow-hidden">
                    {signatureValue ? (
                        <img
                            src={signatureValue}
                            alt="Firma"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none p-2"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300">
                            <PenTool size={24} />
                            <span className="mt-2 text-[10px] font-black uppercase tracking-widest">
                                Sin firma
                            </span>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={abrirModalFirma}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                    {signatureValue ? 'Cambiar firma' : 'Firmar'}
                </button>

                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <User size={14} />
                    </div>

                    <input
                        type="text"
                        placeholder="Nombre completo"
                        value={nameValue || ''}
                        onChange={(e) => onNameChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    />
                </div>
            </div>

            {openModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                                    Firma
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase">
                                    {title}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpenModal(false)}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="relative h-[320px] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden touch-none">
                                {!hasDrawing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300">
                                        <PenTool size={36} />
                                        <span className="mt-3 text-xs font-black uppercase tracking-widest">
                                            Firme dentro del recuadro
                                        </span>
                                    </div>
                                )}

                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="relative z-10 h-full w-full cursor-crosshair"
                                />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                                <button
                                    type="button"
                                    onClick={limpiarCanvas}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rose-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 transition-all"
                                >
                                    <Trash2 size={16} />
                                    Limpiar
                                </button>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => setOpenModal(false)}
                                        className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                                    >
                                        Cancelar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={guardarFirma}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
                                    >
                                        <Save size={16} />
                                        Guardar firma
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const ExteriorObservaciones = ({ data, onChange }: Props) => {
    const { auth } = usePage<{ auth: { user: any } }>().props;
    const nombreRol = auth.user.roles?.[0]?.slug;
    const esAdminOFbo = nombreRol === 'admin' || nombreRol === 'fbo';
    const esJefe = nombreRol === 'jefe_area';
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500 rounded-xl text-white">
                        <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Observaciones Finales</h3>
                </div>

                <textarea
                    placeholder="Escriba aquí cualquier hallazgo adicional o comentario..."
                    className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-600 shadow-inner resize-none"
                    value={data.observaciones || ''}
                    onChange={(e) => onChange({ observaciones: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SignaturePad
                    title="Responsable/Piloto"
                    nameValue={data.nombreResponsable}
                    signatureValue={data.firmaResponsable}
                    onNameChange={(val) => onChange({ nombreResponsable: val })}
                    onSave={(blob) => onChange({ firmaResponsable: blob })}
                    onClear={() => onChange({ firmaResponsable: null })}
                />
                {(esAdminOFbo || esJefe) && (
                    <SignaturePad
                        title="Jefe de Área / Supervisor"
                        nameValue={data.nombreJefe}
                        signatureValue={data.firmaJefe}
                        onNameChange={(val) => onChange({ nombreJefe: val })}
                        onSave={(blob) => onChange({ firmaJefe: blob })}
                        onClear={() => onChange({ firmaJefe: null })}
                    />
                )}
                {esAdminOFbo && (
                    <SignaturePad
                        title="VoBo FBO (Representante)"
                        nameValue={data.nombreFbo}
                        signatureValue={data.firmaFbo}
                        onNameChange={(val) => onChange({ nombreFbo: val })}
                        onSave={(blob) => onChange({ firmaFbo: blob })}
                        onClear={() => onChange({ firmaFbo: null })}
                    />
                )}
            </div>
        </div>
    );
};

export default ExteriorObservaciones;
