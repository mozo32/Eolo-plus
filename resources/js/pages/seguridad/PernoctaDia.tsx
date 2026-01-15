import AppLayout from "@/layouts/app-layout";
import { Head } from "@inertiajs/react";
import { useState } from "react";
import { type BreadcrumbItem } from "@/types";
import PernoctaDiaForm, { PernoctaDiaItem } from "./pernoctaDia/PernoctaDiaForm";
import PernoctaDiaTable from "./pernoctaDia/PernoctaDiaTable";
import { guardarPernoctaDiaApi } from "@/stores/apiPernoctaDia";
import Swal from "sweetalert2";
const breadcrumbs: BreadcrumbItem[] = [
    { title: "Pernocta de Día" },
];

export default function PernoctaDia() {
    const [items, setItems] = useState<PernoctaDiaItem[]>([]);
    const [success, setSuccess] = useState(false);

    const handleAdd = (item: PernoctaDiaItem) => {
        setItems((prev) => [...prev, item]);
        setSuccess(false); // reset mensaje si agregan de nuevo
    };

    const handleRemove = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleGuardar = async () => {
        if (!items.length) return;

        const horaActual = getHoraActual();

        const itemsForms = items.map((item) => ({
            ...item,
            hora: horaActual,
        }));
        await guardarPernoctaDiaApi(itemsForms);
        await Swal.fire({
                icon: "success",
                title: "Pernocta del dia guardado",
            });

        // aquí luego va axios / inertia.post
        await new Promise((r) => setTimeout(r, 500));

        setItems([]);
        setSuccess(true);
    };
    const getHoraActual = () =>
        new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pernocta de Día" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <PernoctaDiaForm onAdd={handleAdd} />

                {/* MENSAJE DE ÉXITO */}
                {success && (
                    <div className="rounded-lg border border-green-300 bg-green-100 px-4 py-3 text-sm text-green-800">
                        Los datos se guardaron correctamente
                    </div>
                )}
                <div className="flex justify-end">
                    <button
                        onClick={handleGuardar}
                        disabled={!items.length}
                        className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        Guardar
                    </button>
                </div>
                <PernoctaDiaTable
                    items={items}
                    onRemove={handleRemove}
                />


            </div>
        </AppLayout>
    );
}
