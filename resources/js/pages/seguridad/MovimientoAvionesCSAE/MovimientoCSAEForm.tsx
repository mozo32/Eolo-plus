import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import MovimientoCSAEEntrada from "./MovimientoCSAEEntrada";
import MovimientoCSAESalida from "./MovimientoCSAESalida";
import MovimientoCSAEEditarCompleto from "./MovimientoCSAEEditarCompleto";
import {
    guardarMovimientoCSAEApi,
    guardarMovimientoCSASalida,
} from "@/stores/apiMovimientoCSAE";
import Swal from "sweetalert2";

type Props = {
    isEdit: boolean;
    modoSalida?: boolean;
    modoCompleto?: boolean;
    data?: any;
    open: boolean;
    onSuccess?: () => void | Promise<void>;
};

const getInitialForm = (data?: any) => {
    const firmaEntrada = data?.firmas?.find(
        (f: any) => f.rol === "firma_entrada" && f.status === "A"
    );

    const firmaSalida = data?.firmas?.find(
        (f: any) => f.rol === "firma_salida" && f.status === "A"
    );

    return {
        fecha_hora_entrada: data?.fecha_hora_entrada ?? "",
        matricula: data?.matricula ?? "",
        tipo_aeronave: data?.tipo_aeronave ?? "",
        como_llega: data?.como_llega ?? "",
        transportista: data?.transportista ?? "",
        observaciones_entrada: data?.observaciones_entrada ?? "",

        fecha_hora_salida: data?.fecha_hora_salida ?? "",
        observaciones_salida: data?.observaciones_salida ?? "",
        quien_recibe: data?.quien_recibe ?? "",
        firma_entrada: firmaEntrada?.url ?? "",
        firma_salida: firmaSalida?.url ?? "",
    };
};

export default function MovimientoCSAEForm({
    isEdit,
    modoSalida = false,
    modoCompleto = false,
    data,
    open,
    onSuccess,
}: Props) {
    const [formData, setFormData] = useState(() => getInitialForm(data));

    useEffect(() => {
        if (open) {
            setFormData(getInitialForm(isEdit ? data : undefined));
        }
    }, [data, isEdit, modoSalida, modoCompleto, open]);

    const updateField = (key: string, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        try {
            Swal.fire({
                title: "Procesando...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            if (isEdit && data?.id) {
                await guardarMovimientoCSASalida(data.id, formData);
            } else {
                await guardarMovimientoCSAEApi(formData);
            }

            await Swal.fire({
                icon: "success",
                title: modoCompleto
                    ? "Registro actualizado correctamente"
                    : modoSalida
                        ? "Salida guardada correctamente"
                        : "Entrada guardada correctamente",
                timer: 1200,
                showConfirmButton: false,
            });

            await onSuccess?.();
        } catch (e: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: e.message || "No se pudo guardar la información",
            });
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto p-6 space-y-8"
        >
            {modoCompleto ? (
                <MovimientoCSAEEditarCompleto
                    data={formData}
                    onChange={handleChange}
                    updateField={updateField}
                />
            ) : modoSalida ? (
                <MovimientoCSAESalida
                    data={formData}
                    onChange={handleChange}
                    updateField={updateField}
                />
            ) : (
                <MovimientoCSAEEntrada
                    data={formData}
                    onChange={handleChange}
                    updateField={updateField}
                />
            )}

            <div className="text-center">
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-8 py-2 rounded hover:bg-blue-700"
                >
                    {modoCompleto
                        ? "Actualizar registro completo"
                        : modoSalida
                            ? "Guardar salida"
                            : "Guardar movimiento"}
                </button>
            </div>
        </form>
    );
}
