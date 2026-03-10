import React, { useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import Swal from 'sweetalert2';
import PressureGauge from './PressureGauge';
import MatriculaAutocomplete from '@/pages/despacho/components/walkAround/MatriculaAutocomplete';

interface EoloFormData {
    fecha: string;
    operador: string;
    cliente: string;
    formaPago: string;
    aeronaveTipo: string;
    matricula: string;
    destino: string;
    horaLlegada: string;
    horaFinal: string;
    lecturaFinal: string;
    horaInicial: string;
    lecturaInicial: string;
    presionDif: number;
}

type Role = { slug: string; nombre: string; };
export type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };

const SignaturePad = ({ label, onClear, canvasRef }: {
    label: string,
    onClear: () => void,
    canvasRef: React.RefObject<HTMLCanvasElement | null>
}) => {
    const [isDrawing, setIsDrawing] = useState(false);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        if ('touches' in e) e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    return (
        <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{label}</h2>
                <button
                    type="button"
                    onClick={() => {
                        const canvas = canvasRef.current;
                        const ctx = canvas?.getContext('2d');
                        ctx?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
                        onClear();
                    }}
                    className="text-[9px] bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 px-2 py-1 rounded-lg transition-colors font-bold uppercase"
                >
                    Borrar
                </button>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden touch-none h-32">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair"
                />
            </div>
        </div>
    );
};

const EoloForm = ({ onSuccess }: { onSuccess?: () => void }) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;
    const canvasClienteRef = useRef<HTMLCanvasElement>(null);
    const canvasOperadorRef = useRef<HTMLCanvasElement>(null);

    const getXsrfToken = () => {
        return decodeURIComponent(
            document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };

    const { data, setData, reset } = useForm<EoloFormData>({
        fecha: today,
        operador: user?.name || '',
        cliente: '',
        formaPago: '',
        aeronaveTipo: '',
        matricula: '',
        destino: '',
        horaLlegada: '',
        horaFinal: '',
        lecturaFinal: '',
        horaInicial: '',
        lecturaInicial: '',
        presionDif: 0,
    });

    const totalLitros = (Number(data.lecturaFinal) || 0) - (Number(data.lecturaInicial) || 0);

    const handleTimeChange = (name: keyof EoloFormData, value: string) => {
        const rawValue = value.replace(/\D/g, '');
        let formatted = rawValue;
        if (rawValue.length >= 3) {
            formatted = `${rawValue.slice(0, 2)}:${rawValue.slice(2, 4)}`;
        }
        let [hours, minutes] = formatted.split(':');
        if (hours && parseInt(hours) > 23) hours = '23';
        if (minutes && parseInt(minutes) > 59) minutes = '59';
        const finalValue = minutes !== undefined ? `${hours}:${minutes}` : hours;
        setData(name, finalValue.slice(0, 5));
    };

    const handleUppercaseChange = (name: keyof EoloFormData, value: string) => {
        setData(name, value.toUpperCase());
    };

    const handleAeronaveData = (aeronave: any) => {
        setData(prev => ({
            ...prev,
            aeronaveTipo: (aeronave.tipo || '').toUpperCase(),
            cliente: (aeronave.cliente || prev.cliente).toUpperCase()
        }));
    };

    const handleSubmit = async () => {
        if (!data.cliente || !data.lecturaFinal) {
            Swal.fire('Error', 'Por favor completa los campos obligatorios', 'error');
            return;
        }

        setIsSubmitting(true);
        const firmaCliente = canvasClienteRef.current?.toDataURL('image/png');
        const firmaOperador = canvasOperadorRef.current?.toDataURL('image/png');

        try {
            const xsrf = getXsrfToken();
            const payload = {
                ...data,
                totalLitros,
                firmaCliente,
                firmaOperador
            };

            const response = await fetch('api/Remision/remisiones', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                [canvasClienteRef, canvasOperadorRef].forEach(ref => {
                    const ctx = ref.current?.getContext('2d');
                    ctx?.clearRect(0, 0, ref.current?.width || 0, ref.current?.height || 0);
                });

                Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'La remisión se ha registrado correctamente',
                    timer: 2000
                });

                reset();
                if (onSuccess) onSuccess();
            } else {
                throw new Error(result.message || 'Error al guardar la remisión');
            }
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error de Suministro',
                text: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 font-sans">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8 flex items-end justify-between px-2">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">EOLO<span className="text-blue-600">.</span></h1>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Aviation Fuel Control</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Unidad Operativa</p>
                        <p className="text-lg font-bold text-slate-800 underline decoration-blue-500 decoration-2 underline-offset-4">PIPA 1 · EP01</p>
                    </div>
                </header>

                <div className="mb-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xs font-black text-blue-600 uppercase tracking-tighter border-r pr-4 border-slate-200">Logística</h2>
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Operador Responsable</label>
                                <input
                                    value={data.operador}
                                    onChange={e => setData('operador', e.target.value)}
                                    className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Fecha de Servicio</label>
                                <input
                                    type="date"
                                    value={data.fecha}
                                    onChange={e => setData('fecha', e.target.value)}
                                    className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-8 text-[11px] text-slate-500">
                        <p><strong>Producto:</strong> Turbosina</p>
                        <p><strong>Placas:</strong> LC-44-020</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center">
                        <h2 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-tighter">Instrumentación</h2>
                        <PressureGauge
                            value={data.presionDif}
                            onChange={(val) => setData('presionDif', val)}
                        />
                    </div>

                    <div className="md:col-span-8 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <h2 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-tighter">Detalles del Vuelo</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <input
                                    placeholder="Nombre del Cliente"
                                    value={data.cliente}
                                    onChange={e => handleUppercaseChange('cliente', e.target.value)}
                                    className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                                />
                            </div>
                            <input
                                placeholder="Forma de Pago"
                                value={data.formaPago}
                                onChange={e => handleUppercaseChange('formaPago', e.target.value)}
                                className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                            />
                            <input
                                placeholder="Tipo de Aeronave"
                                value={data.aeronaveTipo}
                                onChange={e => handleUppercaseChange('aeronaveTipo', e.target.value)}
                                className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                            />

                            <MatriculaAutocomplete
                                matricula={data.matricula}
                                onMatriculaChange={(val) => setData('matricula', val.toUpperCase())}
                                onAeronaveData={handleAeronaveData}
                                onNuevaMatricula={() => {}}
                            />

                            <div className="md:col-span-2">
                                <input
                                    placeholder="Destino"
                                    value={data.destino}
                                    onChange={e => handleUppercaseChange('destino', e.target.value)}
                                    className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                                />
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-slate-50/50 rounded-2xl">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Cronología</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="relative pl-6 border-l-2 border-slate-200 space-y-8">
                                    <div className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-4 border-slate-300"></div>
                                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-1">Llegada a Plataforma</label>
                                        <input
                                            type="text"
                                            placeholder="HH:MM"
                                            maxLength={5}
                                            value={data.horaLlegada}
                                            onChange={e => handleTimeChange('horaLlegada', e.target.value)}
                                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xl font-mono font-bold w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="relative grid grid-cols-2 gap-3">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-md"></div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-1">Inicio</label>
                                            <input
                                                type="text"
                                                placeholder="HH:MM"
                                                maxLength={5}
                                                value={data.horaInicial}
                                                onChange={e => handleTimeChange('horaInicial', e.target.value)}
                                                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-base font-mono font-bold w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-1">Fin</label>
                                            <input
                                                type="text"
                                                placeholder="HH:MM"
                                                maxLength={5}
                                                value={data.horaFinal}
                                                onChange={e => handleTimeChange('horaFinal', e.target.value)}
                                                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-base font-mono font-bold w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-12 bg-white rounded-[3rem] p-1 overflow-hidden shadow-xl shadow-slate-200/60 border border-slate-100">
                        <div className="grid grid-cols-1 lg:grid-cols-12">
                            <div className="lg:col-span-5 p-8 flex flex-col justify-center border-y lg:border-y-0 lg:border-r border-slate-100">
                                <div className="flex items-center gap-2 mb-6 justify-center lg:justify-start">
                                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Lecturas (Lts)</h2>
                                </div>
                                <div className="space-y-4 relative">
                                    <div className="group">
                                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-2 text-center lg:text-left">Inicial</label>
                                        <input
                                            type="number"
                                            placeholder="000000"
                                            value={data.lecturaInicial}
                                            onChange={e => setData('lecturaInicial', e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-3xl font-mono text-slate-700 text-center focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="flex justify-center -my-2 relative z-10">
                                        <div className="bg-white p-1 rounded-full border border-slate-100 shadow-sm">
                                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-[10px] text-blue-600 uppercase font-bold mb-1 ml-2 tracking-widest text-center lg:text-left">Final</label>
                                        <input
                                            type="number"
                                            placeholder="000000"
                                            value={data.lecturaFinal}
                                            onChange={e => setData('lecturaFinal', e.target.value)}
                                            className="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl px-6 py-4 text-3xl font-mono text-blue-700 text-center focus:bg-white focus:border-blue-400 outline-none transition-all shadow-blue-50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-7 p-8 flex flex-col justify-center bg-blue-50/30">
                                <div className="text-center">
                                    <span className="inline-block px-4 py-1.5 bg-white border border-blue-100 rounded-full text-[10px] font-black uppercase text-blue-600 mb-4 tracking-[0.2em] shadow-sm">
                                        Total Neto
                                    </span>
                                    <div className="flex flex-col items-center">
                                        <span className="text-7xl lg:text-8xl font-black tracking-tighter text-slate-900 tabular-nums">
                                            {totalLitros >= 0 ? totalLitros.toLocaleString() : 0}
                                        </span>
                                        <span className="text-xs font-black text-blue-500 uppercase tracking-[0.4em] mt-2">Litros</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 p-8 bg-white">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-4 bg-slate-800 rounded-full"></div>
                                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Validación y Firmas</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <SignaturePad label="Firma del Cliente / Receptor" canvasRef={canvasClienteRef} onClear={() => { }} />
                                <SignaturePad label="Firma del Operador EOLO" canvasRef={canvasOperadorRef} onClear={() => { }} />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`mt-10 w-full ${isSubmitting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-4 group`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Procesando Registro...
                                    </span>
                                ) : (
                                    <>
                                        <span className="text-lg">Finalizar y Registrar Suministro</span>
                                        <svg className="w-6 h-6 transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EoloForm;
