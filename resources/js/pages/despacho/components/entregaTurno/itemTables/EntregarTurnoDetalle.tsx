import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import Swal from "sweetalert2";
import { deleteEntregraTurno } from "@/stores/apiEntregarTurno";
import {
    fetchEntregaTurnoDetalle,
    EntregaTurnoDetalle as Detalle,
} from "@/stores/apiEntregarTurno";
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
type Props = {
    id: number;
    onClose: () => void;
    onSaved: () => void;
};
type PageProps = {
    auth: {
        user: AuthUser | null;
    };
};
export default function EntregarTurnoDetalle({ id, onClose, onSaved}: Props) {
    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [loading, setLoading] = useState(true);
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    useEffect(() => {
        (async () => {
            try {
                const data = await fetchEntregaTurnoDetalle(id);
                setDetalle(data);
            } catch (e: any) {
                Swal.fire(
                    "Error",
                    e?.message || "No se pudo cargar el detalle",
                    "error"
                );
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="py-10 text-center text-gray-500">
                Cargando información…
            </div>
        );
    }

    if (!detalle) {
        return (
            <div className="py-10 text-center text-red-500">
                No se encontró información
            </div>
        );
    }
    const handleDelete = async () => {
        if (!id) return;

        const r = await Swal.fire({
            icon: "warning",
            title: "¿Eliminar registro?",
            text: "Esta acción no se puede deshacer",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            confirmButtonText: "Eliminar",
            cancelButtonText: "Cancelar",
        });

        if (!r.isConfirmed) return;

        try {


            await deleteEntregraTurno(id);
            Swal.fire("Eliminado", `Registro #${id}`, "success");

            onClose();
            onSaved();
        } catch (e: any) {
            Swal.fire(
                "Error",
                e?.message || "No se pudo eliminar el registro",
                "error"
            );
        }
    };

    return (
        <div className="space-y-8 text-sm text-gray-800 dark:text-gray-200">

            <section>
                <h3 className="mb-3 text-base font-semibold text-primary">
                    Datos generales
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Info label="Fecha" value={detalle.fecha?.split("T")[0]} />
                    <Info label="Nombre" value={detalle.nombre} />
                    <Info label="Quién entrega" value={detalle.nombre_quien_entrega} />
                    <Info
                        label="Jefe de turno"
                        value={detalle.nombre_jefe_turno_despacho}
                    />
                </div>
            </section>

            <section>
                <h3 className="mb-3 text-base font-semibold text-primary">
                    Checklist de comunicación
                </h3>

                <div className="overflow-hidden rounded-lg border">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th className="px-3 py-2 text-left">Equipo</th>
                                <th className="px-3 py-2 text-center">Entregado</th>
                                <th className="px-3 py-2 text-center">Cargado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(
                                detalle.checklist_comunicacion?.items || {}
                            ).map(([k, v]: any) => (
                                <tr key={k} className="border-t">
                                    <td className="px-3 py-2">{k}</td>
                                    <td className="px-3 py-2 text-center">
                                        {v.entregado ? "Sí" : "No"}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {v.cargado}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {detalle.checklist_comunicacion?.fallas && (
                    <p className="mt-2 text-red-600">
                        <strong>Fallas:</strong>{" "}
                        {detalle.checklist_comunicacion.fallas}
                    </p>
                )}
            </section>

            <section>
                <h3 className="mb-3 text-base font-semibold text-primary">
                    Equipo de oficina
                </h3>

                <div className="overflow-hidden rounded-lg border">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th className="px-3 py-2 text-left">Equipo</th>
                                <th className="px-3 py-2 text-center">Existencia</th>
                                <th className="px-3 py-2 text-center">Entregadas</th>
                                <th className="px-3 py-2 text-center">Recibidas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detalle.equipo_oficina?.map((e, i) => (
                                <tr key={i} className="border-t">
                                    <td className="px-3 py-2">{e.equipo}</td>
                                    <td className="px-3 py-2 text-center">
                                        {e.existencia}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {e.entregadas}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {e.recibidas}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h3 className="mb-3 text-base font-semibold text-primary">
                    Copiadoras
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Info label="Funciona" value={detalle.copiadoras?.funciona} />
                    <Info label="Tóner" value={detalle.copiadoras?.toner} />
                    <Info label="Paquetes" value={detalle.copiadoras?.paquetes} />
                </div>

                {detalle.copiadoras?.fallas && (
                    <p className="mt-2 text-red-600">
                        <strong>Fallas:</strong> {detalle.copiadoras.fallas}
                    </p>
                )}
            </section>

            <section>
                <h3 className="mb-3 text-base font-semibold text-primary">
                    Fondo de documentación
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Info label="Fondo recibido" value={detalle.fondo_documentacion?.fondoRecibido} />
                    <Info label="Vales gasolina" value={detalle.fondo_documentacion?.cantidadValesGasolina} />
                    <Info label="Fondo entregado" value={detalle.fondo_documentacion?.fondoEntregado} />
                    <Info label="Folio vales gasolina" value={detalle.fondo_documentacion?.folioValesGasolina} />
                    <Info label="Reporte aterrizaje" value={detalle.fondo_documentacion?.reporteAterisaje} />
                    <Info label="Cantidad reportes" value={detalle.fondo_documentacion?.cantidadReporteAterisaje} />
                    <Info label="Llegadas operación" value={detalle.fondo_documentacion?.totalLlegadaOperacion} />
                    <Info label="Salidas operación" value={detalle.fondo_documentacion?.totalSalidaOperacion} />
                    <Info label="Reportes enviados" value={detalle.fondo_documentacion?.reportesEnviadosCorreo} />
                    <Info
                        label="Operaciones coordinadas"
                        value={detalle.fondo_documentacion?.cantidadOperacionesCordinadasEntregadas}
                    />
                    <Info label="WalkArounds" value={detalle.fondo_documentacion?.cuantosWalkArounds} />
                </div>
            </section>

            <section>
                <h3 className="mb-2 text-base font-semibold text-primary">
                    Estado de caja fuerte
                </h3>
                <p className="rounded-lg border p-3 bg-gray-50 dark:bg-gray-800">
                    {detalle.estado_caja_fuerte || "Sin observaciones"}
                </p>
            </section>

            <section className="pt-4 border-t text-xs text-gray-500">
                Creado: {detalle.created_at?.split("T")[0]} ·
                Última actualización: {detalle.updated_at?.split("T")[0]}
            </section>
            <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
                <button
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                    Cerrar
                </button>

                {user?.isAdmin && (
                    <button
                        onClick={handleDelete}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Eliminar
                    </button>
                )}
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: any }) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p>{value ?? "-"}</p>
        </div>
    );
}
