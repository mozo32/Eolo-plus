import AppLayout from "@/layouts/app-layout";
import { Head } from "@inertiajs/react";
import { useState } from "react";
import { type BreadcrumbItem } from "@/types";
import PernoctaDiaForm, { PernoctaDiaItem } from "./pernoctaDia/PernoctaDiaForm";
import PernoctaDiaTable from "./pernoctaDia/PernoctaDiaTable";
import { guardarPernoctaDiaApi } from "@/stores/apiPernoctaDia";
import Swal from "sweetalert2";
import { Save, CheckCircle } from "lucide-react";

const breadcrumbs: BreadcrumbItem[] = [{ title: "Pernocta de Día" }];

export default function PernoctaDia() {
    const [items, setItems] = useState<PernoctaDiaItem[]>([]);
    const [success, setSuccess] = useState(false);

    const handleAdd = (item: PernoctaDiaItem) => {
        const existe = items.some(i => i.matricula.toUpperCase() === item.matricula.toUpperCase());
        if (existe) {
            Swal.fire({
                icon: "warning",
                title: "Matrícula duplicada",
                text: "Esta matrícula ya fue agregada a la lista.",
                confirmButtonColor: '#1e3a8a'
            });
            return;
        }
        setItems(prev => [...prev, item]);
        setSuccess(false);
    };

    const handleRemove = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleGuardar = async () => {
        if (!items.length) return;
        const horaActual = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        const itemsForms = items.map((item) => ({ ...item, hora: horaActual }));

        try {
            await guardarPernoctaDiaApi(itemsForms);
            await Swal.fire({
                icon: "success",
                title: "¡Logrado!",
                text: "Pernocta del día guardada correctamente",
                confirmButtonColor: '#1e3a8a'
            });
            setItems([]);
            setSuccess(true);
        } catch (error) {
            Swal.fire("Error", "No se pudo guardar la información", "error");
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pernocta de Día" />
            <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">

                <PernoctaDiaForm onAdd={handleAdd} />

                {success && (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-800 animate-bounce">
                        <CheckCircle size={20} />
                        <span className="text-sm font-bold uppercase tracking-wider">Los datos se guardaron en el sistema correctamente</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Lista de Aeronaves a Registrar</h2>
                        <button
                            onClick={handleGuardar}
                            disabled={!items.length}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-emerald-700 disabled:opacity-30 active:scale-95"
                        >
                            <Save size={16} /> Finalizar y Guardar
                        </button>
                    </div>

                    <PernoctaDiaTable items={items} onRemove={handleRemove} />
                </div>
            </div>
        </AppLayout>
    );
}
