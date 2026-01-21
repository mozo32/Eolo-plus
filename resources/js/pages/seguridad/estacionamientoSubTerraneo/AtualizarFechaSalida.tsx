import { useState } from "react";
import { actualizarEstaSubTerraneo } from "@/stores/apiEstacionamientoSubterraneo";
import Swal from "sweetalert2";

type Props = {
    estacionamientoId: number;
    onClose: () => void;
};

export default function ActualizarFechaSalida({ estacionamientoId, onClose }: Props) {
    const getNowForDateTimeLocal = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        return new Date(now.getTime() - offset * 60000)
            .toISOString()
            .slice(0, 16);
    };

    const [fechaSalida, setFechaSalida] = useState(getNowForDateTimeLocal());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await actualizarEstaSubTerraneo(estacionamientoId, {
                fecha_salida: fechaSalida,
            });
            onClose();
        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al registrar salida",
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <label className="text-sm">Fecha y hora de salida</label>
            <input
                type="datetime-local"
                value={fechaSalida}
                onChange={(e) => setFechaSalida(e.target.value)}
                className="w-full rounded border px-3 py-2"
            />

            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose}>Cancelar</button>
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
                    Registrar salida
                </button>
            </div>
        </form>
    );
}
