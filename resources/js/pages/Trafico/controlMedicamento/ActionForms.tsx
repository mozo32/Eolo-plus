import React, { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Save, PackagePlus, Archive, ClipboardCheck } from 'lucide-react';
import { ViewType, Medicamento, AuthUser } from './types';
import { guardarEntregaMedicamentoApi, revastecimientoMedicamentos, guardarControlMedicamentoApi } from '@/stores/apiControlMedicamento';
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
        cantidad: 1
    });
    const [inventarioData, setInventarioData] = useState({
        medicamentoId: '',
        cantidad: 1
    })
    const handleReabastecer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inventarioData.medicamentoId) {
            Swal.fire({ icon: 'warning', title: 'Atención', text: 'Selecciona un medicamento' });
            return;
        }

        try {
            Swal.fire({ title: 'Actualizando stock...', didOpen: () => Swal.showLoading() });

            await revastecimientoMedicamentos(
                Number(inventarioData.medicamentoId),
                { cantidad: inventarioData.cantidad }
            );

            await Swal.fire({
                icon: 'success',
                title: 'Stock actualizado',
                timer: 1200,
                showConfirmButton: false,
            });

            setInventarioData({ medicamentoId: '', cantidad: 0 });
            onSuccess();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };
    const handleConfirmarEntrega = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

            await guardarEntregaMedicamentoApi(entregaData);

            await Swal.fire({
                icon: 'success',
                title: 'Guardado correctamente',
                timer: 1200,
                showConfirmButton: false,
            });
            setEntregaData({ medicamentoId: '', recibe: '', cantidad: 1 });
            onSuccess();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };
    const handleCierreTurno = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Cierre de Turno',
            html: `
            <p class="text-sm text-slate-500 mb-4">Seleccione los aparatos presentes y firme debajo:</p>
            <div class="flex flex-col gap-3 text-left max-w-xs mx-auto">
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" id="swal-aparato-1" class="w-5 h-5 accent-orange-500">
                    <span class="font-semibold text-slate-700">Aparato 1</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" id="swal-aparato-2" class="w-5 h-5 accent-orange-500">
                    <span class="font-semibold text-slate-700">Aparato 2</span>
                </label>
                <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input type="checkbox" id="swal-aparato-3" class="w-5 h-5 accent-orange-500">
                    <span class="font-semibold text-slate-700">Aparato 3</span>
                </label>
            </div>

            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1 text-left ml-4">Firma de responsabilidad:</label>
                <canvas id="signature-canvas"
                        class="border-2 border-dashed border-slate-300 rounded-lg bg-white touch-none"
                        width="300" height="150"
                        style="cursor: crosshair;"></canvas>
                <button type="button" id="clear-signature" class="mt-2 text-xs text-orange-600 underline">Limpiar firma</button>
            </div>
        `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Cierre',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#f97316',
            didOpen: () => {
                const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
                const ctx = canvas.getContext('2d');
                let drawing = false;

                if (!ctx) return;

                // Estilos de la línea
                ctx.strokeStyle = "#334155";
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";

                const getCoords = (e: MouseEvent | TouchEvent) => {
                    const rect = canvas.getBoundingClientRect();
                    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
                    return { x: clientX - rect.left, y: clientY - rect.top };
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
                window.addEventListener('mouseup', () => drawing = false);
                canvas.addEventListener('touchstart', startDrawing);
                canvas.addEventListener('touchmove', draw);
                canvas.addEventListener('touchend', () => drawing = false);
                document.getElementById('clear-signature')?.addEventListener('click', () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                });
            },
            preConfirm: () => {
                const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement;
                const firma = canvas.toDataURL();

                return {
                    aparatos: {
                        aparato1: (document.getElementById('swal-aparato-1') as HTMLInputElement).checked,
                        aparato2: (document.getElementById('swal-aparato-2') as HTMLInputElement).checked,
                        aparato3: (document.getElementById('swal-aparato-3') as HTMLInputElement).checked,
                    },
                    firma: firma
                };
            }
        });

        if (formValues) {
            const fechaActual = new Date();
            const fechaFormateada = fechaActual.toLocaleDateString('es-ES');
            const diaSemana = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' });

            const reporteMedicamentos: Record<string, { inicio: number, final: number }> = {};

            medicamentos.forEach(m => {
                const entregados = Number(m.total_entregado) || 0;
                reporteMedicamentos[m.nombre] = {
                    inicio: m.cantidad + entregados,
                    final: m.cantidad
                };
            });
            const fechaISO = new Date().toISOString().split('T')[0];
            const datosCierre = {
                responsable: auth?.user?.name ?? "Sin identificar",
                fecha: fechaISO,
                dia: diaSemana,
                aparatos: formValues.aparatos,
                firma: formValues.firma,
                medicamentos: reporteMedicamentos
            };
            try {
                Swal.fire({ title: 'Procesando cierre...', didOpen: () => Swal.showLoading() });
                await guardarControlMedicamentoApi(datosCierre);
                await Swal.fire({
                    icon: 'success',
                    title: 'Cierre registrado',
                    text: 'Los datos se han impreso en consola.',
                    timer: 2000,
                    showConfirmButton: false
                });
                onSuccess();
            } catch (error: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        }
    };
    return (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>

            {view === 'entrega' && (
                <form onSubmit={handleConfirmarEntrega} className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-tight">Registro de Entrega</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Medicamento</label>
                            <select
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-semibold"
                                value={entregaData.medicamentoId}
                                onChange={(e) => setEntregaData({ ...entregaData, medicamentoId: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {medicamentos.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre} ({m.cantidad} disp.)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">¿Quién recibe?</label>
                            <input
                                type="text"
                                placeholder="Nombre completo"
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-semibold"
                                value={entregaData.recibe}
                                onChange={(e) => setEntregaData({ ...entregaData, recibe: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cantidad</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-4 px-4 outline-none font-semibold"
                                    value={entregaData.cantidad}
                                    onChange={(e) => setEntregaData({ ...entregaData, cantidad: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Entrega</label>
                                <input type="text" readOnly value={auth?.user?.name ?? ""} className="w-full bg-slate-100 border-2 border-transparent rounded-2xl py-4 px-4 font-semibold text-slate-500" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                        >
                            Confirmar Entrega <Save size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'inventario' && (
                <form onSubmit={handleReabastecer} className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-tight text-emerald-600">Reabastecer Stock</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Medicamento</label>
                            <select
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl py-4 px-4 outline-none font-semibold"
                                value={inventarioData.medicamentoId}
                                onChange={(e) => setInventarioData({ ...inventarioData, medicamentoId: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {medicamentos.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre} ({m.cantidad} actuales)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cantidad que ingresa</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="0"
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl py-4 px-4 outline-none font-semibold"
                                value={inventarioData.cantidad}
                                onChange={(e) => setInventarioData({ ...inventarioData, cantidad: parseInt(e.target.value) })}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                        >
                            Añadir al Inventario <PackagePlus size={18} />
                        </button>
                    </div>
                </form>
            )}

            {view === 'cierre' && (
                <div className="space-y-6 text-center">
                    <Archive className="mx-auto text-orange-500" size={48} />
                    <h2 className="text-xl font-black uppercase tracking-tight">Cierre de Turno</h2>
                    <p className="text-sm text-slate-500 font-medium">
                        Se generará un reporte comparando el stock inicial vs el stock final del día.
                    </p>
                    <button
                        onClick={handleCierreTurno}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                    >
                        Cerrar y Limpiar Día <ClipboardCheck size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ActionForms;
