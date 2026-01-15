import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
    fetchEntregaTurnoDetalle,
    EntregaTurnoDetalle,
    actualizarEntregarTurnoApi,
} from "@/stores/apiEntregarTurno";
import EntregaTurnoForm from "../EntregaTurnoForm";

type Props = {
    id: number;
    onClose: () => void;
    onSaved: () => void;
};

export default function EntregarTurnoEditar({ id, onClose, onSaved }: Props) {
    const [loading, setLoading] = useState(true);
    const [initialData, setInitialData] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                const d: EntregaTurnoDetalle = await fetchEntregaTurnoDetalle(id);

                setInitialData({
                    fecha: d.fecha?.split("T")[0],
                    nombre: d.nombre,
                    nombreQuienEntrega: d.nombre_quien_entrega,
                    nombreJefeTurnoDespacho: d.nombre_jefe_turno_despacho,
                    checklistComunicacion: d.checklist_comunicacion,
                    equipoOficina: d.equipo_oficina,
                    copiadoras: d.copiadoras,
                    fondoDocumentacion: d.fondo_documentacion,
                    estadoCajaFuerte: d.estado_caja_fuerte,
                });
            } catch (e: any) {
                Swal.fire("Error", e.message || "No se pudo cargar el registro", "error");
                onClose();
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return <div className="py-10 text-center text-gray-500">Cargando…</div>;
    }

    return (
        <EntregaTurnoForm
            id={id}
            initialData={initialData}
            isEdit
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}
