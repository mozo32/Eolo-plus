import React, { useState, useRef, useLayoutEffect } from 'react';
import { Trash2, ClipboardCheck, PenTool, XCircle, Circle, Save } from 'lucide-react';
import camioPipa from '../../../../../resources/js/assets/Captura de pantalla 2026-02-10 121721.png';

interface Marca {
    x: number;
    y: number;
    tipo: 'X' | 'O';
}

interface Props {
    estaCompleto: boolean;
    onGuardar: (datosFirmas: any) => void;
    marcas: Marca[];
    setMarcas: React.Dispatch<React.SetStateAction<Marca[]>>;
}

const CardFirma = ({ titulo, id, nombre, setNombres, canvasRef }: any) => {
    const limpiarCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return (
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-700">
                <PenTool size={16} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-widest">{titulo}</span>
            </div>
            <input
                type="text"
                placeholder="Nombre del responsable"
                value={nombre}
                onChange={(e) => setNombres((prev: any) => ({ ...prev, [id]: e.target.value }))}
                className="w-full bg-transparent border-b-2 border-slate-200 py-2 mb-4 outline-none focus:border-blue-500 transition-colors text-sm"
            />
            <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden h-36">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" />
                <button type="button" onClick={limpiarCanvas} className="absolute bottom-2 right-2 p-2 bg-slate-100/80 backdrop-blur-sm text-slate-400 rounded-lg hover:text-red-500 transition-all z-10">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export const SeccionFirmas = ({ estaCompleto, onGuardar, marcas, setMarcas }: Props) => {
    const [modo, setModo] = useState<'X' | 'O'>('X');
    const [nombres, setNombres] = useState({ entrega: '', receptor: '', operaciones: '' });
    const canvasRefs = {
        entrega: useRef<HTMLCanvasElement>(null),
        receptor: useRef<HTMLCanvasElement>(null),
        operaciones: useRef<HTMLCanvasElement>(null)
    };

    const prepararGuardado = () => {
        const firmasFinales = {
            entrega: { nombre: nombres.entrega, imagen: canvasRefs.entrega.current?.toDataURL() },
            receptor: { nombre: nombres.receptor, imagen: canvasRefs.receptor.current?.toDataURL() },
            operaciones: { nombre: nombres.operaciones, imagen: canvasRefs.operaciones.current?.toDataURL() }
        };
        onGuardar(firmasFinales);
    };

    useLayoutEffect(() => {
        const initializers = Object.values(canvasRefs).map(ref => {
            const canvas = ref.current;
            if (!canvas) return null;
            const ctx = canvas.getContext('2d', { desynchronized: true });
            if (!ctx) return null;

            const resize = () => {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#1e293b';
            };
            resize();

            let isDrawing = false;
            const getPointerPos = (e: any) => {
                const rect = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                return { x: clientX - rect.left, y: clientY - rect.top };
            };

            const start = (e: any) => {
                isDrawing = true;
                const { x, y } = getPointerPos(e);
                ctx.beginPath();
                ctx.moveTo(x, y);
            };
            const move = (e: any) => {
                if (!isDrawing) return;
                const { x, y } = getPointerPos(e);
                ctx.lineTo(x, y);
                ctx.stroke();
            };
            const stop = () => { isDrawing = false; ctx.closePath(); };

            canvas.addEventListener('mousedown', start);
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', stop);
            canvas.addEventListener('touchstart', start);
            canvas.addEventListener('touchmove', move);
            canvas.addEventListener('touchend', stop);

            return () => {
                canvas.removeEventListener('mousedown', start);
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', stop);
                canvas.removeEventListener('touchstart', start);
                canvas.removeEventListener('touchmove', move);
                canvas.removeEventListener('touchend', stop);
            };
        });
        return () => initializers.forEach(clean => clean?.());
    }, []);

    const manejarClicImagen = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMarcas([...marcas, {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            tipo: modo
        }]);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12 p-4">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-lg text-white"><ClipboardCheck size={24} /></div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Inspección Final y Firmas</h2>
                    <p className="text-sm text-slate-500">Registre daños y firme para finalizar</p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-slate-50/50">
                    <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setModo('X')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${modo === 'X' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>FALTANTE</button>
                        <button type="button" onClick={() => setModo('O')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${modo === 'O' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>DAÑO</button>
                    </div>
                    <button type="button" onClick={() => setMarcas(marcas.slice(0, -1))} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase">Deshacer</button>
                </div>
                <div className="p-8 flex justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                    <div className="relative cursor-crosshair" onClick={manejarClicImagen}>
                        <img src={camioPipa} alt="Pipa" className="h-[300px] md:h-[400px] w-auto object-contain rotate-90" />
                        {marcas.map((m, i) => (
                            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
                                {m.tipo === 'X' ? <XCircle className="text-red-500 fill-white" size={24} /> : <Circle className="text-amber-500 fill-white" size={24} />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardFirma titulo="Entrega de Turno" id="entrega" nombre={nombres.entrega} setNombres={setNombres} canvasRef={canvasRefs.entrega} />
                <CardFirma titulo="Receptor de Turno" id="receptor" nombre={nombres.receptor} setNombres={setNombres} canvasRef={canvasRefs.receptor} />
                <CardFirma titulo="Operaciones FBO" id="operaciones" nombre={nombres.operaciones} setNombres={setNombres} canvasRef={canvasRefs.operaciones} />
            </div>

            <div className="mt-8">
                <button
                    type="button"
                    onClick={prepararGuardado}
                    disabled={!estaCompleto}
                    className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                        estaCompleto ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    <Save size={20} />
                    FINALIZAR REVISIÓN
                </button>
            </div>
        </div>
    );
};
