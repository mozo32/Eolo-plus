import React, { useState } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Save,
    PackagePlus,
    Archive,
    ClipboardCheck,
    Eraser,
    Activity,
    Pill,
    Ban,
    PlusCircle,
} from 'lucide-react';
import { ViewType, Medicamento, AuthUser } from './types';
import {
    guardarEntregaMedicamentoApi,
    revastecimientoMedicamentos,
    guardarControlMedicamentoApi,
    deshabilitarMedicamento,
    agregarMedicamento,
} from '@/stores/apiControlMedicamento';
import Swal from 'sweetalert2';

interface Props {
    view: ViewType;
    medicamentos: Medicamento[];
    onSuccess: () => void;
}

const ActionForms: React.FC<Props> = ({ view, medicamentos, onSuccess }) => {
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;

    const [entregaData, setEntregaData] = useState({
        medicamentoId: '',
        recibe: '',
        cantidad: '1',
    });

    const [inventarioData, setInventarioData] = useState({
        medicamentoId: '',
        cantidad: '1',
    });

    const [medicamentoAdminData, setMedicamentoAdminData] = useState({
        medicamentoId: '',
    });

    const [nuevoMedicamentoData, setNuevoMedicamentoData] = useState({
        nombre: '',
        stockInicial: '',
    });

    const handleReabastecer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inventarioData.medicamentoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento',
            });
            return;
        }

        if (!inventarioData.cantidad || Number(inventarioData.cantidad) < 1) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'La cantidad debe ser mayor a 0',
            });
            return;
        }

        try {
            Swal.fire({
                title: 'Actualizando stock...',
                didOpen: () => Swal.showLoading(),
            });

            await revastecimientoMedicamentos(Number(inventarioData.medicamentoId), {
                cantidad: Number(inventarioData.cantidad),
            });

            await Swal.fire({
                icon: 'success',
                title: 'Stock actualizado',
                timer: 1200,
                showConfirmButton: false,
            });

            setInventarioData({
                medicamentoId: '',
                cantidad: '1',
            });

            onSuccess();
        } catch (e: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: e.message,
            });
        }
    };

    const handleConfirmarEntrega = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!entregaData.medicamentoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento',
            });
            return;
        }

        if (!entregaData.cantidad || Number(entregaData.cantidad) < 1) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'La cantidad debe ser mayor a 0',
            });
            return;
        }

        try {
            Swal.fire({
                title: 'Procesando...',
                didOpen: () => Swal.showLoading(),
            });

            await guardarEntregaMedicamentoApi({
                medicamentoId: entregaData.medicamentoId,
                recibe: entregaData.recibe,
                cantidad: Number(entregaData.cantidad),
            });

            await Swal.fire({
                icon: 'success',
                title: 'Guardado correctamente',
                timer: 1200,
                showConfirmButton: false,
            });

            setEntregaData({
                medicamentoId: '',
                recibe: '',
                cantidad: '1',
            });

            onSuccess();
        } catch (e: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: e.message,
            });
        }
    };

    const handleDeshabilitarMedicamento = async () => {
        if (!medicamentoAdminData.medicamentoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento',
            });
            return;
        }

        const medicamentoSeleccionado = medicamentos.find(
            (m) => m.id === Number(medicamentoAdminData.medicamentoId)
        );

        const confirmar = await Swal.fire({
            icon: 'warning',
            title: '¿Deshabilitar medicamento?',
            text: medicamentoSeleccionado
                ? `Se deshabilitará: ${medicamentoSeleccionado.nombre}`
                : 'Este medicamento ya no aparecerá como activo.',
            showCancelButton: true,
            confirmButtonText: 'Sí, deshabilitar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
        });

        if (!confirmar.isConfirmed) return;

        try {
            Swal.fire({
                title: 'Deshabilitando...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false,
            });

            await deshabilitarMedicamento(Number(medicamentoAdminData.medicamentoId));

            await Swal.fire({
                icon: 'success',
                title: 'Medicamento deshabilitado',
                text: medicamentoSeleccionado
                    ? `${medicamentoSeleccionado.nombre} fue deshabilitado correctamente.`
                    : 'El medicamento fue deshabilitado correctamente.',
                timer: 1500,
                showConfirmButton: false,
            });

            setMedicamentoAdminData({
                medicamentoId: '',
            });

            onSuccess();
        } catch (e: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: e.message || 'No se pudo deshabilitar el medicamento',
            });
        }
    };

    const handleAgregarMedicamento = async () => {
        if (!nuevoMedicamentoData.nombre.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Escribe el nombre del medicamento',
            });
            return;
        }

        const stockInicial = Number(nuevoMedicamentoData.stockInicial || 0);

        try {
            Swal.fire({
                title: 'Agregando medicamento...',
                didOpen: () => Swal.showLoading(),
                allowOutsideClick: false,
            });

            await agregarMedicamento({
                nombre: nuevoMedicamentoData.nombre.trim(),
                stockInicial,
            });

            await Swal.fire({
                icon: 'success',
                title: 'Medicamento agregado',
                text: 'El medicamento fue agregado correctamente.',
                timer: 1500,
                showConfirmButton: false,
            });

            setNuevoMedicamentoData({
                nombre: '',
                stockInicial: '',
            });

            onSuccess();

        } catch (e: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: e.message || 'No se pudo agregar el medicamento',
            });
        }
    };

    const handleCierreTurno = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Protocolo de Cierre de Turno',
            html: `
            <div class="text-left mt-4">
                <p class="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Inventario de Equipos</p>
                <div class="grid grid-cols-1 gap-2 mb-6">
                    <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                        <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">Oxímetro</span>
                        <input type="checkbox" id="swal-oximetro" class="w-5 h-5 accent-orange-500">
                    </label>
                    <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                        <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">Baumanómetro</span>
                        <input type="checkbox" id="swal-baumanometro" class="w-5 h-5 accent-orange-500">
                    </label>
                    <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                        <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">Monitor de Presión</span>
                        <input type="checkbox" id="swal-monitor" class="w-5 h-5 accent-orange-500">
                    </label>
                    <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                        <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">Estetoscopio</span>
                        <input type="checkbox" id="swal-estetoscopio" class="w-5 h-5 accent-orange-500">
                    </label>
                </div>

                <p class="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Firma de Conformidad</p>
                <div class="relative bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
                    <canvas id="signature-canvas" width="400" height="180" class="w-full h-auto touch-none cursor-crosshair"></canvas>
                    <button type="button" id="clear-signature" class="absolute bottom-2 right-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                        Limpiar
                    </button>
                </div>
            </div>
            `,
            customClass: {
                container: 'rounded-3xl',
                popup: 'rounded-[2rem] p-6',
                confirmButton: 'rounded-2xl font-black uppercase text-sm tracking-widest px-8 py-4',
                cancelButton: 'rounded-2xl font-black uppercase text-sm tracking-widest',
            },
            width: '450px',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Finalizar Jornada',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#f97316',
            didOpen: () => {
                const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d');
                let drawing = false;

                if (!ctx) return;

                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';

                const getCoords = (e: MouseEvent | TouchEvent) => {
                    const rect = canvas.getBoundingClientRect();
                    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

                    return {
                        x: clientX - rect.left,
                        y: clientY - rect.top,
                    };
                };

                const startDrawing = (e: MouseEvent | TouchEvent) => {
                    drawing = true;
                    const { x, y } = getCoords(e);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                };

                const draw = (e: MouseEvent | TouchEvent) => {
                    if (!drawing) return;
                    e.preventDefault();
                    const { x, y } = getCoords(e);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                };

                canvas.addEventListener('mousedown', startDrawing);
                canvas.addEventListener('mousemove', draw);
                window.addEventListener('mouseup', () => (drawing = false));
                canvas.addEventListener('touchstart', startDrawing);
                canvas.addEventListener('touchmove', draw);
                canvas.addEventListener('touchend', () => (drawing = false));

                document.getElementById('clear-signature')?.addEventListener('click', () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                });
            },
            preConfirm: () => {
                const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
                const firma = canvas.toDataURL();

                return {
                    aparatos: {
                        oximetro: (document.getElementById('swal-oximetro') as HTMLInputElement).checked,
                        baumanometro: (document.getElementById('swal-baumanometro') as HTMLInputElement).checked,
                        monitor_presion: (document.getElementById('swal-monitor') as HTMLInputElement).checked,
                        estetoscopio: (document.getElementById('swal-estetoscopio') as HTMLInputElement).checked,
                    },
                    firma,
                };
            },
        });

        if (formValues) {
            const fechaActual = new Date();
            const diaSemana = fechaActual.toLocaleDateString('es-ES', {
                weekday: 'long',
            });

            const reporteMedicamentos: Record<string, { inicio: number; final: number }> = {};

            medicamentos.forEach((m) => {
                const entregados = Number(m.total_entregado) || 0;

                reporteMedicamentos[m.nombre] = {
                    inicio: m.cantidad + entregados,
                    final: m.cantidad,
                };
            });

            const datosCierre = {
                responsable: auth?.user?.name ?? 'Sin identificar',
                fecha: new Date().toLocaleDateString('en-CA'),
                dia: diaSemana,
                aparatos: formValues.aparatos,
                firma: formValues.firma,
                medicamentos: reporteMedicamentos,
            };

            try {
                Swal.fire({
                    title: 'Procesando cierre...',
                    didOpen: () => Swal.showLoading(),
                });

                await guardarControlMedicamentoApi(datosCierre);

                await Swal.fire({
                    icon: 'success',
                    title: 'Cierre registrado',
                    timer: 2000,
                    showConfirmButton: false,
                });

                onSuccess();
            } catch (error: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message,
                });
            }
        }
    };

    const barraColor =
        view === 'entrega'
            ? 'bg-blue-600'
            : view === 'inventario'
                ? 'bg-emerald-600'
                : view === 'medicamentos'
                    ? 'bg-violet-600'
                    : 'bg-orange-500';

    return (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${barraColor}`} />

            {view === 'entrega' && (
                <form onSubmit={handleConfirmarEntrega} className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Registro de Entrega
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                Medicamento
                            </label>
                            <select
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-bold transition-all"
                                value={entregaData.medicamentoId}
                                onChange={(e) =>
                                    setEntregaData({
                                        ...entregaData,
                                        medicamentoId: e.target.value,
                                    })
                                }
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {medicamentos.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre} ({m.cantidad} disp.)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                ¿Quién recibe?
                            </label>
                            <input
                                type="text"
                                placeholder="Nombre"
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-bold"
                                value={entregaData.recibe}
                                onChange={(e) =>
                                    setEntregaData({
                                        ...entregaData,
                                        recibe: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                    Cantidad
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-bold"
                                    value={entregaData.cantidad}
                                    onChange={(e) =>
                                        setEntregaData({
                                            ...entregaData,
                                            cantidad: e.target.value,
                                        })
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                    Quien Entrega
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={auth?.user?.name ?? ''}
                                    className="w-full bg-slate-100 border-2 border-transparent rounded-2xl py-4 px-4 font-bold text-slate-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                            Confirmar Entrega
                            <Save size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'inventario' && (
                <form onSubmit={handleReabastecer} className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-tight text-emerald-600">
                        Reabastecer Stock
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                Medicamento
                            </label>
                            <select
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl py-4 px-4 outline-none font-bold"
                                value={inventarioData.medicamentoId}
                                onChange={(e) =>
                                    setInventarioData({
                                        ...inventarioData,
                                        medicamentoId: e.target.value,
                                    })
                                }
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {medicamentos.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre} ({m.cantidad} actuales)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                Cantidad que ingresa
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="0"
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl py-4 px-4 outline-none font-bold"
                                value={inventarioData.cantidad}
                                onChange={(e) =>
                                    setInventarioData({
                                        ...inventarioData,
                                        cantidad: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                            Añadir al Inventario
                            <PackagePlus size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'medicamentos' && (
                <div className="space-y-8">
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-violet-700">
                                <Pill size={24} />
                                Medicamentos
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                Administración visual de medicamentos activos.
                            </p>
                        </div>

                        <div className="bg-violet-50 border border-violet-100 rounded-3xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                                    <Ban size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black uppercase text-slate-800 text-sm">
                                        Deshabilitar medicamento
                                    </h3>
                                    <p className="text-xs text-slate-500 font-semibold">
                                        Selecciona un medicamento existente.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                    Medicamento
                                </label>
                                <select
                                    className="w-full bg-white border-2 border-transparent focus:border-violet-600 rounded-2xl py-4 px-4 outline-none font-bold transition-all"
                                    value={medicamentoAdminData.medicamentoId}
                                    onChange={(e) =>
                                        setMedicamentoAdminData({
                                            ...medicamentoAdminData,
                                            medicamentoId: e.target.value,
                                        })
                                    }
                                >
                                    <option value="">Seleccionar...</option>
                                    {medicamentos.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.nombre} ({m.cantidad} disp.)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={handleDeshabilitarMedicamento}
                                className="w-full bg-slate-900 hover:bg-red-600 text-white font-black py-5 rounded-2xl shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                            >
                                Deshabilitar
                                <Ban size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-5 border-t border-slate-100 pt-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <PlusCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-black uppercase text-slate-800">
                                    Agregar nuevo medicamento
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold">
                                    Captura el nombre y el stock inicial.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                    Nombre del medicamento
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. Paracetamol"
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-600 rounded-2xl py-4 px-4 outline-none font-bold"
                                    value={nuevoMedicamentoData.nombre}
                                    onChange={(e) =>
                                        setNuevoMedicamentoData({
                                            ...nuevoMedicamentoData,
                                            nombre: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                                    Stock inicial
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-violet-600 rounded-2xl py-4 px-4 outline-none font-bold"
                                    value={nuevoMedicamentoData.stockInicial}
                                    onChange={(e) =>
                                        setNuevoMedicamentoData({
                                            ...nuevoMedicamentoData,
                                            stockInicial: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAgregarMedicamento}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                            >
                                Agregar medicamento
                                <PlusCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'cierre' && (
                <div className="space-y-6 text-center py-4">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Archive className="text-orange-600" size={32} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">
                            Cierre de Jornada
                        </h2>
                        <p className="text-sm text-slate-500 font-medium px-4">
                            Al finalizar, se registrará el stock final de medicamentos y el estado de los equipos médicos.
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-left space-y-3 mx-2">
                        <div className="flex items-center gap-3 text-slate-600">
                            <ClipboardCheck size={18} className="text-orange-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                Verificación de insumos
                            </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-600">
                            <Activity size={18} className="text-orange-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                Estado de equipos
                            </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-600">
                            <Eraser size={18} className="text-orange-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                Limpieza de registros diarios
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleCierreTurno}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                        Iniciar Protocolo de Cierre
                        <ClipboardCheck size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ActionForms;
