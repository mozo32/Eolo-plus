import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { pdf } from "@react-pdf/renderer";
import EntregaTurnoPdfDoc from "./EntregaTurnoPdfDoc";
import { fetchEntregaTurnoDetalle, EntregaTurnoDetalle } from "@/stores/apiEntregarTurno";

type Props = {
    id: number | null;
    onDone: () => void;
};

export default function EntregaTurnoPdfExporterReactPdf({ id, onDone }: Props) {
    const [detalle, setDetalle] = useState<EntregaTurnoDetalle | null>(null);

    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                const data = await fetchEntregaTurnoDetalle(id);
                setDetalle(data);
            } catch (e: any) {
                Swal.fire("Error", e?.message || "No se pudo cargar la entrega", "error");
                onDone();
            }
        })();
    }, [id, onDone]);

    useEffect(() => {
        if (!detalle) return;

        (async () => {
            try {
                const blob = await pdf(
                    <EntregaTurnoPdfDoc detalle={detalle} />
                ).toBlob();

                const filename = `EntregaTurno_${detalle.id}_${detalle.fecha}.pdf`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);

                await Swal.fire({
                    icon: "success",
                    title: "PDF generado",
                    text: "El archivo se descargó correctamente.",
                    timer: 2000,
                    showConfirmButton: false,
                });

            } catch (e: any) {
                Swal.fire("Error", "No se pudo generar el PDF", "error");
            } finally {
                onDone();
            }
        })();
    }, [detalle, onDone]);

    return null;
}
