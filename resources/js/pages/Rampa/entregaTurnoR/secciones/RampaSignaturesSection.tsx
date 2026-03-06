import React, { useRef, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { UserCheck, ShieldCheck, PenTool, Eraser } from 'lucide-react';

interface SignatureBoxProps {
    role: string;
    icon: React.ReactNode;
    color: string;
    name: string;
    initialSignature: string | null;
    onNameChange: (val: string) => void;
    onSignatureChange: (signatureData: string | null) => void;
}
interface RampaSignaturesProps {
    data: any;
    onUpdate: (role: string, field: string, value: any) => void;
}
type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;

    isAdmin: boolean;
    roles: Role[];
};
const DrawableCanvas: React.FC<{ onSave: (data: string) => void, onClear: () => void }> = ({ onSave, onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = "#1e293b";
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const getPos = (e: any) => {
            const rect = canvas.getBoundingClientRect();
            // Soporte para touch y mouse
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startDrawing = (e: any) => {
            setIsDrawing(true);
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e: any) => {
            if (!isDrawing) return;
            // IMPORTANTE: Prevenir scroll en móviles mientras se firma
            if (e.touches) e.preventDefault();

            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            if (isDrawing) {
                setIsDrawing(false);
                ctx.closePath();
                onSave(canvas.toDataURL());
            }
        };

        // Listeners
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [isDrawing, onSave]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onClear();
        }
    };

    return (
        <div className="relative group border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-32 touch-none">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
            />
            <button
                type="button"
                onClick={handleClear}
                className="absolute bottom-2 right-2 p-2 bg-white/80 hover:bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm transition-all"
            >
                <Eraser size={14} />
            </button>
        </div>
    );
};

const SignatureBox: React.FC<SignatureBoxProps> = ({
    role, icon, color, name, initialSignature, onNameChange, onSignatureChange
}) => (
    <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${color} shadow-lg`}>
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-black text-slate-800 tracking-tighter">{role}</h4>
                <p className="text-[9px] font-bold text-slate-400 tracking-widest">Firma Autógrafa</p>
            </div>
        </div>

        <div className="space-y-4">
            <div>
                <label className="text-[9px] font-black text-slate-400 ml-2 mb-1 block">Nombre Completo</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Escriba su nombre..."
                    className="w-full bg-slate-50 border-none rounded-xl py-2 px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-100"
                />
            </div>
            <div>
                <label className="text-[9px] font-black text-slate-400 ml-2 mb-1 block">Firma</label>
                {initialSignature && (initialSignature.startsWith('/storage') || initialSignature.startsWith('http')) ? (
                    <div className="relative group border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50 overflow-hidden h-32 flex items-center justify-center">
                        <img
                            src={initialSignature}
                            alt={`Firma ${role}`}
                            className="max-h-28 object-contain"
                        />
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded-full shadow-sm">
                            REGISTRADA
                        </div>
                    </div>
                ) : (
                    <DrawableCanvas
                        onSave={onSignatureChange}
                        onClear={() => onSignatureChange(null)}
                    />
                )}
            </div>
        </div>
    </div>
);

const RampaSignaturesSection: React.FC<RampaSignaturesProps> = ({ data, onUpdate }) => {

    return (
        <div className="mt-12 space-y-8">
            <h2 className="text-blue-800 font-bold border-b-2 border-blue-100 mb-4 pb-1 ">
                Cierre de Operación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SignatureBox
                    role="Entrega"
                    icon={<UserCheck size={20} />}
                    color="bg-blue-500"
                    initialSignature={data.entrega.firma}
                    name={data.entrega.nombre}
                    onNameChange={(val: string) => onUpdate('entrega', 'nombre', val)}
                    onSignatureChange={(val: string | null) => onUpdate('entrega', 'firma', val)}
                />

                <SignatureBox
                    role="Jefe de Área"
                    icon={<ShieldCheck size={20} />}
                    color="bg-slate-800"
                    initialSignature={data.jefe.firma}
                    name={data.jefe.nombre}
                    onNameChange={(val: string) => onUpdate('jefe', 'nombre', val)}
                    onSignatureChange={(val: string | null) => onUpdate('jefe', 'firma', val)}
                />
                <SignatureBox
                    role="Recibe"
                    icon={<UserCheck size={20} />}
                    initialSignature={data.recibe.firma}
                    color="bg-emerald-500"
                    name={data.recibe.nombre}
                    onNameChange={(val: string) => onUpdate('recibe', 'nombre', val)}
                    onSignatureChange={(val: string | null) => onUpdate('recibe', 'firma', val)}
                />
            </div>
        </div>
    );
};

export default RampaSignaturesSection;
