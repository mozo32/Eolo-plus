import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Trash2, CheckCircle2, User } from 'lucide-react';
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
    const [hasInteraction, setHasInteraction] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000000';
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        setHasInteraction(true); // Ocultar la imagen del servidor al empezar a dibujar
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
        if (canvas) onSave(canvas.toDataURL('image/png'));
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasInteraction(true);
            onClear();
        }
    };

    return (
        <div className="flex flex-col gap-4 bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm transition-all hover:border-slate-200">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 tracking-widest">{title}</span>
                <button onClick={handleClear} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-32 relative touch-none overflow-hidden">
                {signatureValue && !hasInteraction && (
                    <img
                        src={signatureValue}
                        alt="Firma"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none p-2"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
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
                    className="w-full h-full cursor-crosshair relative z-10"
                />

                {!isDrawing && !signatureValue && !hasInteraction && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <PenTool size={24} />
                     </div>
                )}
            </div>

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
