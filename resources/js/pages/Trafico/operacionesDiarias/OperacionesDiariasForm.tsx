import { useState } from "react";
import TimePicker24 from "@/pages/TimePicker24";
import { guardarOperacionesDiariasApi } from "@/stores/apiOperacionesDiarias";
import Swal from "sweetalert2";

type TipoOperacion = "llegada" | "salida";

type OperacionForm = {
    fecha: string;
    tipo: TipoOperacion;
    matricula: string;
    equipo: string;
    hora: string;
    lugar: string;
    pax: string;
};
type Props = {
    onSuccess?: () => void;
};
export default function OperacionesDiariasForm({
    onSuccess,
}: Props)  {
    const [form, setForm] = useState<OperacionForm>({
        fecha: "",
        tipo: "llegada",
        matricula: "",
        equipo: "",
        hora: "",
        lugar: "",
        pax: "",
    });

    const updateField = (campo: keyof OperacionForm, value: string) => {
        setForm((prev) => ({ ...prev, [campo]: value }));
    };

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();

        console.log("Registro guardado:", form);

        try {
            Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });

            // if (isEdit && data?.id) {
            //     await actualizarServicioComisariatoApi(data.id, form);

            // } else {
            //     await guardarServicioComisariatoApi(form);
            // }
            await guardarOperacionesDiariasApi(form);
            Swal.fire({
                icon: "success",
                // title: isEdit ? "Servicio de Comisariato actualizado" : "Servicio de Comisariato Guardado",
                title: "Operación Guardado",
            });
            onSuccess?.();

        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al guardar",
            });
        }
        setForm({
            fecha: "",
            tipo: "llegada",
            matricula: "",
            equipo: "",
            hora: "",
            lugar: "",
            pax: "",
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 shadow space-y-6"
        >
            {/* ENCABEZADO */}
            <div className="text-center border-b pb-4">
                <h2 className="text-lg font-extrabold uppercase text-slate-800">
                    Registro de Operación
                </h2>
                <p className="text-sm font-semibold uppercase text-slate-500">
                    Área de Tráfico
                </p>
            </div>

            {/* SECCIÓN 1 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="text-xs font-semibold text-slate-600">Fecha</label>
                    <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2"
                        value={form.fecha}
                        onChange={(e) => updateField("fecha", e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-slate-600">Tipo</label>
                    <select
                        className="w-full rounded-md border px-3 py-2 font-semibold"
                        value={form.tipo}
                        onChange={(e) => updateField("tipo", e.target.value)}
                    >
                        <option value="llegada">Entrada</option>
                        <option value="salida">Salida</option>
                    </select>
                </div>
            </div>

            {/* SECCIÓN 2 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="text-xs font-semibold text-slate-600">Matrícula</label>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.matricula}
                        onChange={(e) => updateField("matricula", e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-slate-600">Equipo</label>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.equipo}
                        onChange={(e) => updateField("equipo", e.target.value)}
                    />
                </div>
            </div>

            {/* SECCIÓN HORA */}
            <div className="rounded-lg border bg-slate-50 p-4">
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                    Hora (24 horas)
                </label>
                <TimePicker24
                    value={form.hora}
                    onChange={(value) => updateField("hora", value)}
                />
            </div>

            {/* SECCIÓN FINAL */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="text-xs font-semibold text-slate-600">
                        {form.tipo === "llegada" ? "Procedencia" : "Destino"}
                    </label>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.lugar}
                        onChange={(e) => updateField("lugar", e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-slate-600">Pax</label>
                    <input
                        type="number"
                        className="w-full rounded-md border px-3 py-2"
                        value={form.pax}
                        onChange={(e) => updateField("pax", e.target.value)}
                    />
                </div>
            </div>

            {/* ACCIÓN */}
            <div className="flex justify-end border-t pt-4">
                <button
                    type="submit"
                    className="rounded-md bg-[#00677F] px-10 py-2 text-sm font-bold text-white hover:bg-[#00586D]"
                >
                    Guardar Operación
                </button>
            </div>
        </form>
    );
}
