import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

type WalkAroundRow = {
    id: number;
    fecha: string;
    matricula: string;
    movimiento: string;
    destino?: string;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onActivated?: () => void;
};

export default function WalkAroundBasurero({ open, onClose, onActivated}: Props) {
    const [rows, setRows] = useState<WalkAroundRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        const load = async () => {
            try {
                setLoading(true);
                const res = await axios.get("/api/walkarounds/basurero");
                setRows(res.data);
            } catch (e) {
                Swal.fire("Error", "No se pudo cargar el basurero", "error");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [open]);

    const activar = async (id: number) => {
        const r = await Swal.fire({
            title: "¿Activar WalkAround?",
            text: "El registro volverá a la lista principal",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sí, activar",
            cancelButtonText: "Cancelar",
        });

        if (!r.isConfirmed) return;

        try {
            await axios.get(`/api/walkarounds/${id}/active`);

            // quitar del basurero
            setRows(prev => prev.filter(row => row.id !== id));

            onActivated?.();

            Swal.fire("Activado", "El WalkAround fue restaurado", "success");
        } catch (e) {
            Swal.fire("Error", "No se pudo activar el registro", "error");
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="relative w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">

                {/* Header */}
                <div className="mb-3 flex items-center justify-between border-b pb-2 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Basurero WalkAround
                    </h2>

                    <button
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500
                        hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabla */}
                {loading ? (
                    <p className="py-10 text-center text-gray-500">Cargando…</p>
                ) : (
                    <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            <tr>
                                <th className="px-3 py-2 text-left">#</th>
                                <th className="px-3 py-2 text-left">Fecha</th>
                                <th className="px-3 py-2 text-left">Movimiento</th>
                                <th className="px-3 py-2 text-left">Matrícula</th>
                                <th className="px-3 py-2 text-left">Destino</th>
                                <th className="px-3 py-2 text-center">Acciones</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td className="px-3 py-2">{row.id}</td>
                                    <td className="px-3 py-2">{row.fecha}</td>
                                    <td className="px-3 py-2">{row.movimiento}</td>
                                    <td className="px-3 py-2">{row.matricula}</td>
                                    <td className="px-3 py-2">{row.destino ?? "-"}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => activar(row.id)}
                                            className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                                        >
                                            Activar
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!rows.length && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-gray-500">
                                        No hay registros en el basurero
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Footer */}
                <div className="mt-6 flex justify-end border-t pt-4 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
