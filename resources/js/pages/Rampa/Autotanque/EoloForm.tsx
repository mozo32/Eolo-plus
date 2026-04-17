import React, { useRef, useState, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import Swal from 'sweetalert2';
import PressureGauge from './PressureGauge';
import MatriculaAutocomplete from '@/pages/despacho/components/walkAround/MatriculaAutocomplete';
import { ultimaLectura, obtenerResponsableHistoricosApi } from '@/stores/apiRemision';
import { updateRemision } from '@/stores/apiAutoTanque';

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

const EoloForm = ({ data: externalData, isEdit, onSuccess }: {
    data?: any,
    isEdit?: boolean,
    onSuccess?: () => void
}) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;
    const canvasClienteRef = useRef<HTMLCanvasElement>(null);
    const canvasOperadorRef = useRef<HTMLCanvasElement>(null);
    const [sugerenciasNombres, setSugerenciasNombres] = useState<string[]>([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
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
    const isLecturaInvalid = data.lecturaFinal !== '' &&
        data.lecturaInicial !== '' &&
        Number(data.lecturaFinal) < Number(data.lecturaInicial);

    const getXsrfToken = () => {
        return decodeURIComponent(
            document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };

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

    const handleAeronaveData = async (aeronave: any) => {

        try {
            const nombres = await obtenerResponsableHistoricosApi(aeronave.matricula);
            setSugerenciasNombres(nombres);
            setMostrarSugerencias(true);
        } catch (error) {
            console.error(error);
        }
        setData(prev => ({
            ...prev,
            aeronaveTipo: (aeronave.tipo || '').toUpperCase(),
            cliente: (aeronave.cliente || prev.cliente).toUpperCase()
        }));
    };

    const handleSubmit = async () => {
        if (!data.cliente || !data.lecturaFinal || isLecturaInvalid) {
            Swal.fire('Error', 'Verifica los campos obligatorios y lecturas', 'error');
            return;
        }

        setIsSubmitting(true);
        const firmaCliente = canvasClienteRef.current?.toDataURL('image/png');
        const firmaOperador = canvasOperadorRef.current?.toDataURL('image/png');

        try {
            const payload = {
                ...data,
                totalLitros,
                firmaCliente,
                firmaOperador
            };

            let result;

            if (isEdit && externalData?.id) {
                // --- LÓGICA DE ACTUALIZACIÓN ---
                result = await updateRemision(externalData.id, payload);
            } else {
                // --- LÓGICA DE CREACIÓN (Tu fetch actual) ---
                const xsrf = getXsrfToken();
                const response = await fetch('api/Remision/remisiones', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': xsrf,
                    },
                    body: JSON.stringify(payload)
                });
                result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error al guardar');
            }

            Swal.fire({
                icon: 'success',
                title: isEdit ? '¡Actualizado!' : '¡Guardado!',
                text: isEdit ? 'El registro se actualizó correctamente' : 'La remisión se ha registrado correctamente',
                timer: 2000
            });

            if (!isEdit) reset(); // Solo resetear si es nuevo
            if (onSuccess) onSuccess();

        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: isEdit ? 'Error al actualizar' : 'Error de Suministro',
                text: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (externalData) {
            setData({
                fecha: externalData.fecha || today,
                operador: externalData.operador || '',
                cliente: externalData.cliente || '',
                formaPago: externalData.forma_pago || '',
                aeronaveTipo: externalData.aeronave_tipo || '',
                matricula: externalData.matricula || '',
                destino: externalData.destino || '',
                horaLlegada: externalData.hora_llegada || '',
                horaFinal: externalData.hora_final || '',
                lecturaFinal: externalData.lectura_final || '',
                horaInicial: externalData.hora_inicial || '',
                presionDif: Number(externalData.presionDif) || 0,
                lecturaInicial: externalData.lectura_inicial || '',
            });

            const firmaClienteObj = externalData.firmas?.find((f: any) => f.pivot?.rol === 'cliente');
            const firmaOperadorObj = externalData.firmas?.find((f: any) => f.pivot?.rol === 'operador');

            const firmasAPintar = [
                { ref: canvasClienteRef, path: firmaClienteObj?.path },
                { ref: canvasOperadorRef, path: firmaOperadorObj?.path }
            ];

            firmasAPintar.forEach(item => {
                if (item.path && item.ref.current) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const canvas = item.ref.current;
                        const ctx = canvas?.getContext('2d');
                        if (ctx && canvas) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }
                    };
                    img.src = `/storage/${item.path}`;
                }
            });
        } else {
            reset();
        }
    }, [externalData]);

    useEffect(() => {
        if (!isEdit) {
            const consultarUltimaLectura = async () => {
                try {
                    const resultado = await ultimaLectura();

                    if (resultado && resultado.lectura_final) {
                        setData('lecturaInicial', resultado.lectura_final);
                    }
                } catch (error) {
                    console.error("Error al obtener la hora de la matrícula:", error);
                }
            };

            consultarUltimaLectura();
        }
    }, [isEdit]);
    const formatVisual = (val: string | number) => {
        if (!val && val !== 0) return "";
        let stringVal = val.toString().split('.')[0];
        const numericValue = stringVal.replace(/\D/g, "");
        return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 font-sans">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8 flex items-end justify-between px-2">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">EOLO</h1>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Control de combustible de aviación</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Unidad Operativa</p>
                        <p className="text-lg font-bold text-slate-800 underline decoration-blue-500 decoration-2 underline-offset-4">PIPA 1 · EP01</p>
                    </div>
                </header>

                <div className="mb-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
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
                        <p><strong>Producto:</strong> Turbosina JET A</p>
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
                            <MatriculaAutocomplete
                                matricula={data.matricula}
                                onMatriculaChange={(val) => setData('matricula', val.toUpperCase())}
                                onAeronaveData={handleAeronaveData}
                                onNuevaMatricula={() => { }}
                            />
                            <input
                                placeholder="Forma de Pago"
                                value={data.formaPago}
                                onChange={e => handleUppercaseChange('formaPago', e.target.value)}
                                className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                            />
                            <div className="relative group">
                                <input
                                    placeholder="Nombre del Cliente"
                                    value={data.cliente}
                                    onChange={e => {
                                        handleUppercaseChange('cliente', e.target.value);
                                        setMostrarSugerencias(true);
                                    }}
                                    onFocus={() => setMostrarSugerencias(true)}
                                    className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
                                />
                                {mostrarSugerencias && sugerenciasNombres.length > 0 && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setMostrarSugerencias(false)}
                                        ></div>

                                        <ul className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <li className="px-4 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                                                Sugerencias históricas
                                            </li>
                                            {sugerenciasNombres
                                                .filter(nombre =>
                                                    nombre.toLowerCase().includes(data.cliente.toLowerCase())
                                                )
                                                .map((nombre, index) => (
                                                    <li
                                                        key={index}
                                                        onClick={() => {
                                                            setData('cliente', nombre.toUpperCase());
                                                            setMostrarSugerencias(false);
                                                        }}
                                                        className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors flex items-center gap-2 font-medium"
                                                    >
                                                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        {nombre}
                                                    </li>
                                                ))
                                            }
                                            {sugerenciasNombres.filter(n => n.toLowerCase().includes(data.cliente.toLowerCase())).length === 0 && (
                                                <li className="px-4 py-3 text-xs text-slate-400 italic">
                                                    No hay coincidencias exactas...
                                                </li>
                                            )}
                                        </ul>
                                    </>
                                )}
                            </div>
                            <input
                                placeholder="Tipo de Aeronave"
                                value={data.aeronaveTipo}
                                onChange={e => handleUppercaseChange('aeronaveTipo', e.target.value)}
                                className="w-full border-slate-100 border-2 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all uppercase"
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
                                <h2 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-tighter">Cronología</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="relative pl-6 border-l-2 border-slate-200 space-y-8">
                                    <div className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-4 border-slate-300"></div>
                                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-1">Llegada de Autotanque</label>
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
                                    <h2 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-tighter">Lecturas (Lts)</h2>
                                </div>
                                <div className="space-y-4 relative">
                                    <div className="group">
                                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 ml-2 text-center lg:text-left">Lectura Inicial</label>
                                        <input
                                            type="text"
                                            placeholder="000000"
                                            value={formatVisual(data.lecturaInicial)}
                                            onChange={e => {
                                                const rawValue = e.target.value.replace(/\D/g, "");
                                                setData('lecturaInicial', rawValue);
                                            }}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-3xl font-mono text-slate-700 text-center focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    <div className="group">
                                        <label className={`block text-[10px] uppercase font-bold mb-1 ml-2 tracking-widest text-center lg:text-left ${isLecturaInvalid ? 'text-red-500' : 'text-blue-600'}`}>
                                            Lectura Final
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="000,000"
                                            value={formatVisual(data.lecturaFinal)}
                                            onChange={e => {
                                                const rawValue = e.target.value.replace(/\D/g, "");
                                                setData('lecturaFinal', rawValue);
                                            }}
                                            className={`w-full border-2 rounded-2xl px-6 py-4 text-3xl font-mono text-center outline-none transition-all ${
                                                isLecturaInvalid
                                                    ? 'bg-red-50 border-red-200 text-red-700 focus:border-red-400 shadow-red-50'
                                                    : 'bg-blue-50 border-blue-100 text-blue-700 focus:bg-white focus:border-blue-400 shadow-blue-50'
                                            }`}
                                        />
                                        {isLecturaInvalid && (
                                            <p className="text-[10px] text-red-500 font-black uppercase mt-2 text-center animate-pulse">
                                                La lectura final debe ser mayor a la inicial
                                            </p>
                                        )}
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
                                            {totalLitros >= 0 ? totalLitros.toLocaleString('en-US') : 0}
                                        </span>
                                        <span className="text-xs font-black text-blue-500 uppercase tracking-[0.4em] mt-2">Litros</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 p-8 bg-white">
                            <div className="flex items-center gap-2 mb-6">
                                <h2 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-tighter">Validación y Firmas</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <SignaturePad label="Firma del Cliente / Receptor" canvasRef={canvasClienteRef} onClear={() => { }} />
                                <SignaturePad label="Firma del Operador EOLO" canvasRef={canvasOperadorRef} onClear={() => { }} />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || isLecturaInvalid}
                                className={`mt-10 w-full p-4 rounded-2xl font-bold text-white transition-all ${isLecturaInvalid
                                    ? 'bg-slate-800'
                                    : isSubmitting
                                        ? 'bg-slate-400'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100'
                                    }`}
                            >
                                {isSubmitting ? (
                                    "Procesando..."
                                ) : isLecturaInvalid ? (
                                    "Error en Lecturas"
                                ) : isEdit ? (
                                    "Actualizar Registro"
                                ) : (
                                    "Finalizar y Registrar Suministro"
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
