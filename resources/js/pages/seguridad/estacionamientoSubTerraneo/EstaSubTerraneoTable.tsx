import Swal from "sweetalert2";
import { useEffect, useState } from "react";
import EstaSubTerraneoForm from "./EstaSubTerraneoForm";
import ActualizarFechaSalida from "./AtualizarFechaSalida";
import {
    EstacionamientoItem,
    listarEstacionamientoSubTerraneo,
    fetchEstacionamientoDetalle,
} from "@/stores/apiEstacionamientoSubterraneo";

function formatFechaHora(value?: string | null) {
    if (!value) return "—";
    const clean = value.replace(".000000Z", "");
    const date = new Date(clean);

    if (isNaN(date.getTime())) return "—";

    return date.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

export default function EstaSubTerraneoTable() {
    const [rows, setRows] = useState<EstacionamientoItem[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    const [isModalCreate, setIsModalCreate] = useState(false);
    const [isModalEdit, setIsModalEdit] = useState(false);

    const [detalle, setDetalle] = useState<EstacionamientoItem | null>(null);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const res = await listarEstacionamientoSubTerraneo({ search });
            setRows(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleEdit = async (id: number) => {
        try {
            const data = await fetchEstacionamientoDetalle(id);
            setDetalle(data);
            setIsModalEdit(true);
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo cargar el registro",
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Gestión del Estacionamiento Subterráneo
                </h1>

                <div className="flex gap-2">
                    <input
                        placeholder="Buscar (Placas, Responsable, Vehículo...)"
                        className="h-10 w-72 rounded-lg border border-gray-300 px-3 text-sm
                            focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyUp={cargarDatos}
                    />

                    <button
                        onClick={() => setIsModalCreate(true)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                        Registrar vehículo
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Entrada</th>
                            <th className="px-3 py-2 text-left">Vehículo</th>
                            <th className="px-3 py-2 text-left">Placas</th>
                            <th className="px-3 py-2 text-left">Responsable</th>
                            <th className="px-3 py-2 text-left">Salida</th>
                            <th className="px-3 py-2 text-center">Opciones</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y dark:divide-gray-700">
                        {rows.map((row, index) => (
                            <tr
                                key={row.id}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            >
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2">
                                    {formatFechaHora(row.fecha_ingreso)}
                                </td>
                                <td className="px-3 py-2">{row.vehiculo}</td>
                                <td className="px-3 py-2">{row.placas}</td>
                                <td className="px-3 py-2">{row.responsable}</td>
                                <td
                                    className={`px-3 py-2 ${
                                        !row.fecha_salida
                                            ? "text-red-600 font-semibold"
                                            : ""
                                    }`}
                                >
                                    {formatFechaHora(row.fecha_salida)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <button
                                        onClick={() => handleEdit(row.id)}
                                        className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                        title="Registrar salida"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="22"
                                            height="22"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#007aff"
                                            stroke-width="1.75"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            >
                                            <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                                            <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                                            <path d="M16 5l3 3" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {!loading && rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-3 py-6 text-center text-gray-500"
                                >
                                    No hay registros
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL CREAR */}
            {isModalCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-6xl rounded-xl bg-white p-6 dark:bg-slate-900">
                        <div className="mb-3 flex justify-between border-b pb-2">
                            <h2 className="font-semibold">
                                Registrar vehículo
                            </h2>
                            <button onClick={() => setIsModalCreate(false)}>
                                ✕
                            </button>
                        </div>

                        <EstaSubTerraneoForm
                            onClose={() => {
                                setIsModalCreate(false);
                                cargarDatos();
                            }}
                        />
                    </div>
                </div>
            )}

            {/* MODAL SALIDA */}
            {isModalEdit && detalle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-xl rounded-xl bg-white p-6 dark:bg-slate-900">
                        <div className="mb-3 flex justify-between border-b pb-2">
                            <h2 className="font-semibold">
                                Registrar salida
                            </h2>
                            <button
                                onClick={() => {
                                    setIsModalEdit(false);
                                    setDetalle(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <ActualizarFechaSalida
                            estacionamientoId={detalle.id}
                            onClose={() => {
                                setIsModalEdit(false);
                                setDetalle(null);
                                cargarDatos();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
