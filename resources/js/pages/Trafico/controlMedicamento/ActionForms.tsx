import React, { useEffect, useState } from 'react';
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
    CheckCircle2,
    LoaderCircle,
} from 'lucide-react';
import { ViewType, Medicamento, AuthUser } from './types';
import {
    guardarEntregaMedicamentoApi,
    revastecimientoMedicamentos,
    guardarControlMedicamentoApi,
    deshabilitarMedicamento,
    agregarMedicamento,
    fetchMedicamentosDeshabilitados,
    habilitarMedicamento,
} from '@/stores/apiControlMedicamento';
import Swal from 'sweetalert2';

interface Props {
    view: ViewType;
    medicamentos: Medicamento[];
    onSuccess: () => void;
}

const ActionForms: React.FC<Props> = ({
    view,
    medicamentos,
    onSuccess,
}) => {
    const { auth } =
        usePage<{ auth: { user: AuthUser | null } }>().props;

    const [entregaData, setEntregaData] = useState({
        medicamentoId: '',
        recibe: '',
        cantidad: '1',
    });

    const [inventarioData, setInventarioData] = useState({
        medicamentoId: '',
        cantidad: '1',
    });

    const [medicamentoAdminData, setMedicamentoAdminData] =
        useState({
            medicamentoId: '',
        });

    const [
        medicamentosDeshabilitados,
        setMedicamentosDeshabilitados,
    ] = useState<Medicamento[]>([]);

    const [medicamentoHabilitarId, setMedicamentoHabilitarId] =
        useState('');

    const [
        cargandoDeshabilitados,
        setCargandoDeshabilitados,
    ] = useState(false);

    const [nuevoMedicamentoData, setNuevoMedicamentoData] =
        useState({
            nombre: '',
            stockInicial: '',
        });

    const cargarMedicamentosDeshabilitados = async () => {
        setCargandoDeshabilitados(true);

        try {
            const data =
                await fetchMedicamentosDeshabilitados();

            setMedicamentosDeshabilitados(
                Array.isArray(data) ? data : []
            );
        } catch (error) {
            console.error(
                'Error cargando medicamentos deshabilitados:',
                error
            );

            setMedicamentosDeshabilitados([]);
        } finally {
            setCargandoDeshabilitados(false);
        }
    };

    useEffect(() => {
        if (view === 'medicamentos') {
            cargarMedicamentosDeshabilitados();
        }
    }, [view]);

    const handleReabastecer = async (
        event: React.FormEvent
    ) => {
        event.preventDefault();

        if (!inventarioData.medicamentoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento',
            });

            return;
        }

        if (
            !inventarioData.cantidad ||
            Number(inventarioData.cantidad) < 1
        ) {
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
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await revastecimientoMedicamentos(
                Number(inventarioData.medicamentoId),
                {
                    cantidad: Number(
                        inventarioData.cantidad
                    ),
                }
            );

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
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text:
                    error.message ||
                    'No se pudo actualizar el stock',
            });
        }
    };

    const handleConfirmarEntrega = async (
        event: React.FormEvent
    ) => {
        event.preventDefault();

        if (!entregaData.medicamentoId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento',
            });

            return;
        }

        if (!entregaData.recibe.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Escribe el nombre de quien recibe',
            });

            return;
        }

        if (
            !entregaData.cantidad ||
            Number(entregaData.cantidad) < 1
        ) {
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
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await guardarEntregaMedicamentoApi({
                medicamentoId:
                    entregaData.medicamentoId,
                recibe: entregaData.recibe.trim(),
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
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text:
                    error.message ||
                    'No se pudo registrar la entrega',
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

        const medicamentoSeleccionado =
            medicamentos.find(
                (medicamento) =>
                    medicamento.id ===
                    Number(
                        medicamentoAdminData.medicamentoId
                    )
            );

        const confirmar = await Swal.fire({
            icon: 'warning',
            title: '¿Deshabilitar medicamento?',
            text: medicamentoSeleccionado
                ? `Se deshabilitará: ${medicamentoSeleccionado.nombre}`
                : 'Este medicamento dejará de aparecer como activo.',
            showCancelButton: true,
            confirmButtonText: 'Sí, deshabilitar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
        });

        if (!confirmar.isConfirmed) {
            return;
        }

        try {
            Swal.fire({
                title: 'Deshabilitando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await deshabilitarMedicamento(
                Number(
                    medicamentoAdminData.medicamentoId
                )
            );

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

            await cargarMedicamentosDeshabilitados();
            onSuccess();
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text:
                    error.message ||
                    'No se pudo deshabilitar el medicamento',
            });
        }
    };

    const handleHabilitarMedicamento = async () => {
        if (!medicamentoHabilitarId) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'Selecciona un medicamento deshabilitado',
            });

            return;
        }

        const medicamentoSeleccionado =
            medicamentosDeshabilitados.find(
                (medicamento) =>
                    medicamento.id ===
                    Number(medicamentoHabilitarId)
            );

        const confirmar = await Swal.fire({
            icon: 'question',
            title: '¿Habilitar medicamento?',
            text: medicamentoSeleccionado
                ? `Se habilitará: ${medicamentoSeleccionado.nombre}`
                : 'El medicamento volverá a estar disponible.',
            showCancelButton: true,
            confirmButtonText: 'Sí, habilitar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#059669',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
        });

        if (!confirmar.isConfirmed) {
            return;
        }

        try {
            Swal.fire({
                title: 'Habilitando medicamento...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await habilitarMedicamento(
                Number(medicamentoHabilitarId)
            );

            await Swal.fire({
                icon: 'success',
                title: 'Medicamento habilitado',
                text: medicamentoSeleccionado
                    ? `${medicamentoSeleccionado.nombre} fue habilitado correctamente.`
                    : 'El medicamento fue habilitado correctamente.',
                timer: 1500,
                showConfirmButton: false,
            });

            setMedicamentoHabilitarId('');

            await cargarMedicamentosDeshabilitados();
            onSuccess();
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text:
                    error.message ||
                    'No se pudo habilitar el medicamento',
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

        const stockInicial = Number(
            nuevoMedicamentoData.stockInicial || 0
        );

        if (
            Number.isNaN(stockInicial) ||
            stockInicial < 0
        ) {
            Swal.fire({
                icon: 'warning',
                title: 'Atención',
                text: 'El stock inicial no puede ser negativo',
            });

            return;
        }

        try {
            Swal.fire({
                title: 'Agregando medicamento...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await agregarMedicamento({
                nombre:
                    nuevoMedicamentoData.nombre.trim(),
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
        } catch (error: any) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text:
                    error.message ||
                    'No se pudo agregar el medicamento',
            });
        }
    };

    const handleCierreTurno = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Protocolo de Cierre de Turno',
            html: `
                <div class="text-left mt-4">
                    <p class="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">
                        Inventario de Equipos
                    </p>

                    <div class="grid grid-cols-1 gap-2 mb-6">
                        <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                            <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">
                                Oxímetro
                            </span>

                            <input
                                type="checkbox"
                                id="swal-oximetro"
                                class="w-5 h-5 accent-orange-500"
                            >
                        </label>

                        <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                            <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">
                                Baumanómetro
                            </span>

                            <input
                                type="checkbox"
                                id="swal-baumanometro"
                                class="w-5 h-5 accent-orange-500"
                            >
                        </label>

                        <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                            <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">
                                Monitor de Presión
                            </span>

                            <input
                                type="checkbox"
                                id="swal-monitor"
                                class="w-5 h-5 accent-orange-500"
                            >
                        </label>

                        <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group">
                            <span class="font-bold text-slate-700 group-has-[:checked]:text-orange-700">
                                Estetoscopio
                            </span>

                            <input
                                type="checkbox"
                                id="swal-estetoscopio"
                                class="w-5 h-5 accent-orange-500"
                            >
                        </label>
                    </div>

                    <p class="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
                        Firma de Conformidad
                    </p>

                    <div class="relative bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
                        <canvas
                            id="signature-canvas"
                            width="400"
                            height="180"
                            class="w-full h-auto touch-none cursor-crosshair"
                        ></canvas>

                        <button
                            type="button"
                            id="clear-signature"
                            class="absolute bottom-2 right-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            `,
            customClass: {
                container: 'rounded-3xl',
                popup: 'rounded-[2rem] p-6',
                confirmButton:
                    'rounded-2xl font-black uppercase text-sm tracking-widest px-8 py-4',
                cancelButton:
                    'rounded-2xl font-black uppercase text-sm tracking-widest',
            },
            width: '450px',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Finalizar Jornada',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#f97316',
            didOpen: () => {
                const canvas = document.getElementById(
                    'signature-canvas'
                ) as HTMLCanvasElement | null;

                const clearButton =
                    document.getElementById(
                        'clear-signature'
                    );

                const context =
                    canvas?.getContext('2d');

                if (!canvas || !context) {
                    return;
                }

                let drawing = false;

                context.strokeStyle = '#0f172a';
                context.lineWidth = 3;
                context.lineJoin = 'round';
                context.lineCap = 'round';

                const getCoordinates = (
                    event: MouseEvent | TouchEvent
                ) => {
                    const rect =
                        canvas.getBoundingClientRect();

                    const clientX =
                        'touches' in event
                            ? event.touches[0].clientX
                            : event.clientX;

                    const clientY =
                        'touches' in event
                            ? event.touches[0].clientY
                            : event.clientY;

                    return {
                        x:
                            ((clientX - rect.left) /
                                rect.width) *
                            canvas.width,
                        y:
                            ((clientY - rect.top) /
                                rect.height) *
                            canvas.height,
                    };
                };

                const startDrawing = (
                    event: MouseEvent | TouchEvent
                ) => {
                    drawing = true;

                    const { x, y } =
                        getCoordinates(event);

                    context.beginPath();
                    context.moveTo(x, y);
                };

                const draw = (
                    event: MouseEvent | TouchEvent
                ) => {
                    if (!drawing) {
                        return;
                    }

                    event.preventDefault();

                    const { x, y } =
                        getCoordinates(event);

                    context.lineTo(x, y);
                    context.stroke();
                };

                const stopDrawing = () => {
                    drawing = false;
                };

                canvas.addEventListener(
                    'mousedown',
                    startDrawing
                );

                canvas.addEventListener(
                    'mousemove',
                    draw
                );

                window.addEventListener(
                    'mouseup',
                    stopDrawing
                );

                canvas.addEventListener(
                    'touchstart',
                    startDrawing,
                    { passive: false }
                );

                canvas.addEventListener(
                    'touchmove',
                    draw,
                    { passive: false }
                );

                canvas.addEventListener(
                    'touchend',
                    stopDrawing
                );

                clearButton?.addEventListener(
                    'click',
                    () => {
                        context.clearRect(
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );
                    }
                );
            },
            preConfirm: () => {
                const canvas = document.getElementById(
                    'signature-canvas'
                ) as HTMLCanvasElement | null;

                const oximetro =
                    document.getElementById(
                        'swal-oximetro'
                    ) as HTMLInputElement | null;

                const baumanometro =
                    document.getElementById(
                        'swal-baumanometro'
                    ) as HTMLInputElement | null;

                const monitor =
                    document.getElementById(
                        'swal-monitor'
                    ) as HTMLInputElement | null;

                const estetoscopio =
                    document.getElementById(
                        'swal-estetoscopio'
                    ) as HTMLInputElement | null;

                return {
                    aparatos: {
                        oximetro:
                            oximetro?.checked ?? false,
                        baumanometro:
                            baumanometro?.checked ??
                            false,
                        monitor_presion:
                            monitor?.checked ?? false,
                        estetoscopio:
                            estetoscopio?.checked ??
                            false,
                    },
                    firma: canvas?.toDataURL() ?? '',
                };
            },
        });

        if (!formValues) {
            return;
        }

        const fechaActual = new Date();

        const diaSemana =
            fechaActual.toLocaleDateString('es-ES', {
                weekday: 'long',
            });

        const reporteMedicamentos: Record<
            string,
            {
                inicio: number;
                final: number;
            }
        > = {};

        medicamentos.forEach((medicamento) => {
            const entregados =
                Number(medicamento.total_entregado) || 0;

            reporteMedicamentos[
                medicamento.nombre
            ] = {
                inicio:
                    Number(medicamento.cantidad) +
                    entregados,
                final: Number(
                    medicamento.cantidad
                ),
            };
        });

        const datosCierre = {
            responsable:
                auth?.user?.name ?? 'Sin identificar',
            fecha: fechaActual
                .toISOString()
                .slice(0, 10),
            dia: diaSemana,
            aparatos: formValues.aparatos,
            firma: formValues.firma,
            medicamentos: reporteMedicamentos,
        };

        try {
            Swal.fire({
                title: 'Procesando cierre...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            await guardarControlMedicamentoApi(
                datosCierre
            );

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
                text:
                    error.message ||
                    'No se pudo registrar el cierre',
            });
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
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl">
            <div
                className={`absolute left-0 top-0 h-full w-2 transition-colors duration-500 ${barraColor}`}
            />

            {view === 'entrega' && (
                <form
                    onSubmit={handleConfirmarEntrega}
                    className="space-y-6"
                >
                    <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <Activity className="text-blue-600" />
                        Registro de Entrega
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Medicamento
                            </label>

                            <select
                                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none transition-all focus:border-blue-600"
                                value={
                                    entregaData.medicamentoId
                                }
                                onChange={(event) =>
                                    setEntregaData({
                                        ...entregaData,
                                        medicamentoId:
                                            event.target.value,
                                    })
                                }
                                required
                            >
                                <option value="">
                                    Seleccionar...
                                </option>

                                {medicamentos.map(
                                    (medicamento) => (
                                        <option
                                            key={
                                                medicamento.id
                                            }
                                            value={
                                                medicamento.id
                                            }
                                        >
                                            {
                                                medicamento.nombre
                                            }{' '}
                                            (
                                            {
                                                medicamento.cantidad
                                            }{' '}
                                            disp.)
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                ¿Quién recibe?
                            </label>

                            <input
                                type="text"
                                placeholder="Nombre"
                                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-blue-600"
                                value={entregaData.recibe}
                                onChange={(event) =>
                                    setEntregaData({
                                        ...entregaData,
                                        recibe:
                                            event.target.value,
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Cantidad
                                </label>

                                <input
                                    type="number"
                                    min="1"
                                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-blue-600"
                                    value={
                                        entregaData.cantidad
                                    }
                                    onChange={(event) =>
                                        setEntregaData({
                                            ...entregaData,
                                            cantidad:
                                                event.target
                                                    .value,
                                        })
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Quien entrega
                                </label>

                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        auth?.user?.name ??
                                        ''
                                    }
                                    className="w-full rounded-2xl border-2 border-transparent bg-slate-100 px-4 py-4 font-bold text-slate-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-all hover:bg-slate-900"
                        >
                            Confirmar Entrega
                            <Save size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'inventario' && (
                <form
                    onSubmit={handleReabastecer}
                    className="space-y-6"
                >
                    <h2 className="text-xl font-black uppercase tracking-tight text-emerald-600">
                        Reabastecer Stock
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Medicamento
                            </label>

                            <select
                                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-emerald-500"
                                value={
                                    inventarioData.medicamentoId
                                }
                                onChange={(event) =>
                                    setInventarioData({
                                        ...inventarioData,
                                        medicamentoId:
                                            event.target.value,
                                    })
                                }
                                required
                            >
                                <option value="">
                                    Seleccionar...
                                </option>

                                {medicamentos.map(
                                    (medicamento) => (
                                        <option
                                            key={
                                                medicamento.id
                                            }
                                            value={
                                                medicamento.id
                                            }
                                        >
                                            {
                                                medicamento.nombre
                                            }{' '}
                                            (
                                            {
                                                medicamento.cantidad
                                            }{' '}
                                            actuales)
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Cantidad que ingresa
                            </label>

                            <input
                                type="number"
                                min="1"
                                placeholder="0"
                                className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-emerald-500"
                                value={
                                    inventarioData.cantidad
                                }
                                onChange={(event) =>
                                    setInventarioData({
                                        ...inventarioData,
                                        cantidad:
                                            event.target.value,
                                    })
                                }
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700"
                        >
                            Añadir al Inventario
                            <PackagePlus size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'medicamentos' && (
                <div className="space-y-8">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-violet-700">
                            <Pill size={24} />
                            Administrar medicamentos
                        </h2>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Agrega, deshabilita o vuelve a
                            habilitar medicamentos.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white">
                                <Ban size={22} />
                            </div>

                            <div>
                                <h3 className="text-sm font-black uppercase text-slate-800">
                                    Deshabilitar medicamento
                                </h3>

                                <p className="text-xs font-semibold text-slate-500">
                                    Dejará de aparecer en
                                    entregas e inventario.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Medicamento activo
                                </label>

                                <select
                                    className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-4 font-bold outline-none transition-all focus:border-red-500"
                                    value={
                                        medicamentoAdminData.medicamentoId
                                    }
                                    onChange={(event) =>
                                        setMedicamentoAdminData(
                                            {
                                                medicamentoId:
                                                    event
                                                        .target
                                                        .value,
                                            }
                                        )
                                    }
                                >
                                    <option value="">
                                        Seleccionar
                                        medicamento...
                                    </option>

                                    {medicamentos.map(
                                        (medicamento) => (
                                            <option
                                                key={
                                                    medicamento.id
                                                }
                                                value={
                                                    medicamento.id
                                                }
                                            >
                                                {
                                                    medicamento.nombre
                                                }{' '}
                                                (
                                                {
                                                    medicamento.cantidad
                                                }{' '}
                                                disponibles)
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleDeshabilitarMedicamento
                                }
                                disabled={
                                    !medicamentoAdminData.medicamentoId
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Deshabilitar medicamento
                                <Ban size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                                <CheckCircle2 size={23} />
                            </div>

                            <div>
                                <h3 className="text-sm font-black uppercase text-slate-800">
                                    Habilitar medicamento
                                </h3>

                                <p className="text-xs font-semibold text-slate-500">
                                    Volverá a estar disponible
                                    para su uso.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Medicamento deshabilitado
                                </label>

                                <div className="relative">
                                    <select
                                        className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-4 font-bold outline-none transition-all focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                        value={
                                            medicamentoHabilitarId
                                        }
                                        disabled={
                                            cargandoDeshabilitados ||
                                            medicamentosDeshabilitados.length ===
                                                0
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setMedicamentoHabilitarId(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                    >
                                        <option value="">
                                            {cargandoDeshabilitados
                                                ? 'Cargando medicamentos...'
                                                : medicamentosDeshabilitados.length ===
                                                    0
                                                  ? 'No hay medicamentos deshabilitados'
                                                  : 'Seleccionar medicamento...'}
                                        </option>

                                        {medicamentosDeshabilitados.map(
                                            (
                                                medicamento
                                            ) => (
                                                <option
                                                    key={
                                                        medicamento.id
                                                    }
                                                    value={
                                                        medicamento.id
                                                    }
                                                >
                                                    {
                                                        medicamento.nombre
                                                    }{' '}
                                                    (
                                                    {
                                                        medicamento.cantidad
                                                    }{' '}
                                                    en
                                                    stock)
                                                </option>
                                            )
                                        )}
                                    </select>

                                    {cargandoDeshabilitados && (
                                        <LoaderCircle
                                            size={18}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-emerald-600"
                                        />
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleHabilitarMedicamento
                                }
                                disabled={
                                    !medicamentoHabilitarId ||
                                    cargandoDeshabilitados
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Habilitar medicamento
                                <CheckCircle2 size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-8">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                                <PlusCircle size={24} />
                            </div>

                            <div>
                                <h3 className="font-black uppercase text-slate-800">
                                    Agregar nuevo
                                    medicamento
                                </h3>

                                <p className="text-xs font-semibold text-slate-500">
                                    Captura el nombre y el
                                    stock inicial.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Nombre del medicamento
                                </label>

                                <input
                                    type="text"
                                    placeholder="Ej. Paracetamol"
                                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-violet-600"
                                    value={
                                        nuevoMedicamentoData.nombre
                                    }
                                    onChange={(event) =>
                                        setNuevoMedicamentoData(
                                            {
                                                ...nuevoMedicamentoData,
                                                nombre:
                                                    event
                                                        .target
                                                        .value,
                                            }
                                        )
                                    }
                                />
                            </div>

                            <div>
                                <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Stock inicial
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-4 py-4 font-bold outline-none focus:border-violet-600"
                                    value={
                                        nuevoMedicamentoData.stockInicial
                                    }
                                    onChange={(event) =>
                                        setNuevoMedicamentoData(
                                            {
                                                ...nuevoMedicamentoData,
                                                stockInicial:
                                                    event
                                                        .target
                                                        .value,
                                            }
                                        )
                                    }
                                />
                            </div>

                            <button
                                type="button"
                                onClick={
                                    handleAgregarMedicamento
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700"
                            >
                                Agregar medicamento
                                <PlusCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'cierre' && (
                <div className="space-y-6 py-4 text-center">
                    <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
                        <Archive
                            className="text-orange-600"
                            size={32}
                        />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">
                            Cierre de Jornada
                        </h2>

                        <p className="px-4 text-sm font-medium text-slate-500">
                            Al finalizar, se registrará el
                            stock final de medicamentos y el
                            estado de los equipos médicos.
                        </p>
                    </div>

                    <div className="mx-2 space-y-3 rounded-3xl border border-slate-100 bg-slate-50 p-6 text-left">
                        <div className="flex items-center gap-3 text-slate-600">
                            <ClipboardCheck
                                size={18}
                                className="text-orange-500"
                            />

                            <span className="text-xs font-bold uppercase tracking-wider">
                                Verificación de insumos
                            </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-600">
                            <Activity
                                size={18}
                                className="text-orange-500"
                            />

                            <span className="text-xs font-bold uppercase tracking-wider">
                                Estado de equipos
                            </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-600">
                            <Eraser
                                size={18}
                                className="text-orange-500"
                            />

                            <span className="text-xs font-bold uppercase tracking-wider">
                                Limpieza de registros diarios
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCierreTurno}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition-all hover:bg-orange-600"
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
