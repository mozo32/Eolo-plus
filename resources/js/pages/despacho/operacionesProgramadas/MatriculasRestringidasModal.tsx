import InputMatricula from '@/pages/InputMatricula';
import { AlertCircle, Loader2, Plus, ShieldBan, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import SwitchRestriccion from './SwitchRestriccion';
import type { RestriccionesEnPantalla } from './useMatriculasRestringidas';

interface Props {
    /**
     * Estado compartido con el icono de alerta del encabezado: la pantalla monta
     * una sola instancia del hook, así no se duplican consultas ni listeners.
     */
    restricciones: RestriccionesEnPantalla;
    onCerrar: () => void;
}

/**
 * Lista de matrículas con movimientos restringidos.
 *
 * El buscador es el mismo InputMatricula del formulario de programar, con la
 * misma fuente de datos: aquí no hay un catálogo aparte.
 */
export default function MatriculasRestringidasModal({ restricciones: estado, onCerrar }: Props) {
    const { restricciones, cargando, error, agregando, ocupada, agregar, cambiarSwitch, eliminar } = estado;

    const [matricula, setMatricula] = useState('');

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (agregando) return;

        const guardada = await agregar(matricula);

        // El modal se queda abierto; solo se limpia el input.
        if (guardada) setMatricula('');
    };

    const th = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
            <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <button
                    type="button"
                    onClick={onCerrar}
                    className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600"
                >
                    <X size={20} />
                </button>

                <div className="space-y-6 p-6">
                    <header className="border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-red-100 p-2 text-red-600">
                                <ShieldBan size={20} />
                            </span>
                            <div>
                                <h2 className="text-lg font-extrabold uppercase text-slate-800">
                                    Matrículas restringidas
                                </h2>
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Un switch encendido bloquea ese movimiento al programar
                                </p>
                            </div>
                        </div>
                    </header>

                    <form onSubmit={enviar} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex-1">
                            <InputMatricula
                                value={matricula}
                                onSelect={valor => setMatricula(valor.toUpperCase())}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={agregando || matricula.trim() === ''}
                            className="flex items-center justify-center gap-2 rounded-lg bg-[#00677F] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00586D] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {agregando ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            Agregar
                        </button>
                    </form>

                    {error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                            <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <th className={th}>Matrícula</th>
                                        <th className={`${th} text-center`}>Llegada</th>
                                        <th className={`${th} text-center`}>Salida</th>
                                        <th className={`${th} text-right`}>Acciones</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {cargando ? (
                                        <tr>
                                            <td colSpan={4} className="py-16 text-center">
                                                <Loader2 className="mx-auto animate-spin text-indigo-500" size={28} />
                                            </td>
                                        </tr>
                                    ) : restricciones.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-16 text-center">
                                                <ShieldBan className="mx-auto mb-3 text-slate-200" size={32} />
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                    No hay matrículas restringidas
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        restricciones.map(restriccion => {
                                            const bloqueada = ocupada(restriccion.matricula);

                                            return (
                                                <tr
                                                    key={restriccion.matricula}
                                                    className="border-b border-slate-50 transition-colors hover:bg-slate-50/80"
                                                >
                                                    <td className="px-6 py-4 text-sm font-black uppercase tracking-tighter text-slate-800">
                                                        {restriccion.matricula}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <SwitchRestriccion
                                                            activo={restriccion.llegada}
                                                            deshabilitado={bloqueada}
                                                            etiqueta={`Restringir la llegada de ${restriccion.matricula}`}
                                                            onCambiar={valor =>
                                                                cambiarSwitch(restriccion.matricula, 'llegada', valor)
                                                            }
                                                        />
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <SwitchRestriccion
                                                            activo={restriccion.salida}
                                                            deshabilitado={bloqueada}
                                                            etiqueta={`Restringir la salida de ${restriccion.matricula}`}
                                                            onCambiar={valor =>
                                                                cambiarSwitch(restriccion.matricula, 'salida', valor)
                                                            }
                                                        />
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end">
                                                            <button
                                                                type="button"
                                                                disabled={bloqueada}
                                                                onClick={() => eliminar(restriccion.matricula)}
                                                                title="Eliminar restricciones"
                                                                className="p-2 text-slate-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <footer className="flex justify-end border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onCerrar}
                            className="rounded-lg bg-slate-800 px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-900"
                        >
                            Cerrar
                        </button>
                    </footer>
                </div>
            </div>
        </div>
    );
}
