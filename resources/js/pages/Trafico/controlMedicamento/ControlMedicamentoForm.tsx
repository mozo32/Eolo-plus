import Swal from "sweetalert2";
import { useState } from "react";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { usePage } from "@inertiajs/react";
import { guardarControlMedicamentoApi, actualizarControlMedicamentoApi } from "@/stores/apiControlMedicamento";
function FirmaBox({
    label,
    value,
    onClick,
}: {
    label: string;
    value?: string;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-orange-500 hover:bg-orange-50"
        >
            <span className="mb-2 text-xs font-bold uppercase text-slate-600">
                {label}
            </span>

            {value ? (
                <img
                    src={value}
                    alt={label}
                    className="h-24 w-full object-contain"
                />
            ) : (
                <span className="text-sm text-slate-400">
                    Toca para firmar
                </span>
            )}
        </div>
    );
}
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
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};
const Hourglass = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ff2d55"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M6.5 7h11" />
        <path d="M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z" />
        <path d="M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1z" />
    </svg>
);

const Check = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4cd964"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M5 12l5 5l10 -10" />
    </svg>
);
const MEDICAMENTOS = [
    "Aspirina",
    "Ketorolaco",
    "Genoprazol",
    "Granedodin",
    "Picot",
    "Loratadina",
    "Toallas femeninas",
    "Protectores diarios",
    "Cafiaspirina",
    "Buscapina",
    "Curitas",
    "Tempra / Paracetamol",
    "Naproxeno",
    "Treda",
    "Pepto Bismol",
    "XL-3 VR",
    "Agrifen",
    "Micropore",
    "Diclofenaco gel",
    "Microdacyn spray",
    "Ibuprofeno",
    "Syncol",
    "Alka Seltzer",
];

const getDiaActual = () => {
    const dias = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
    ];
    return dias[new Date().getDay()];
};

type Medicamento = {
    inicio: number | null;
    final: number | null;
};

type FormState = {
    responsable: string;
    fecha: string;
    dia: string;
    firma: string;
    medicamentos: Record<string, Medicamento>;
};

export default function ControlMedicamentoForm({
    initialData,
    isEdit,
    onClose,
    onSaved,
}: {
    initialData?: any;
    isEdit: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [openFirma, setOpenFirma] = useState<
        null | "firma_responsable"
    >(null);

    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const user = auth?.user;
    const [form, setForm] = useState<FormState>(() => {
        const meds: Record<string, Medicamento> = {};

        MEDICAMENTOS.forEach((m) => {
            meds[m] = {
                inicio: initialData?.medicamentos?.[m]?.inicio ?? null,
                final: initialData?.medicamentos?.[m]?.final ?? null,
            };
        });

        return {
            responsable: initialData?.responsable ?? user?.name ?? '',
            fecha: new Date().toISOString().split('T')[0],
            dia: initialData?.dia ?? getDiaActual(),
            firma: initialData?.firmas[0].url ?? '',
            medicamentos: meds,
        };
    });

    const [activo, setActivo] = useState<string | null>(null);
    const [mostrarFirma, setMostrarFirma] = useState(false);
    const [firma, setFirma] = useState("");

    /* ================= MEDICAMENTO ================= */

    const guardarMedicamento = (med: string, inicio: number, final: number) => {
        setForm((prev) => ({
            ...prev,
            medicamentos: {
                ...prev.medicamentos,
                [med]: { inicio, final },
            },
        }));
        setActivo(null);
    };

    const intentarGuardar = () => {
        for (const med of MEDICAMENTOS) {
            const m = form.medicamentos[med];

            if (m.inicio === null || m.final === null) {
                alert(`Falta capturar ${med}`);
                return;
            }

            if (m.final > m.inicio) {
                alert(`En ${med}, el FINAL no puede ser mayor al INICIO`);
                return;
            }
        }

        setMostrarFirma(true);
    };

    const confirmarGuardar = async () => {
        if (!isEdit && (!form.firma || !form.firma.startsWith("data:image"))) {
            alert("La firma es obligatoria");
            return;
        }

        if (isEdit && !form.firma) {
            alert("La firma es obligatoria");
            return;
        }

        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

            if (isEdit) {
                await actualizarControlMedicamentoApi(initialData.id, form);
            } else {
                await guardarControlMedicamentoApi(form);
            }

            await Swal.fire({
                icon: 'success',
                title: isEdit
                    ? 'Actualizado correctamente'
                    : 'Guardado correctamente',
                timer: 1200,
                showConfirmButton: false,
            });

            setMostrarFirma(false);
            onSaved();

        } catch (e: any) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="rounded-2xl border bg-white p-6 shadow">
                <h2 className="text-center text-xl font-extrabold uppercase tracking-widest text-[#00677F]">
                    {form.dia}
                </h2>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                        placeholder="Responsable"
                        className="w-full rounded-lg border-2 border-slate-400 px-4 py-3 text-lg font-bold focus:border-[#00677F] focus:outline-none"
                        value={form.responsable}
                        onChange={(e) =>
                            setForm({ ...form, responsable: e.target.value })
                        }
                    />
                    <input
                        type="date"
                        className="w-full rounded-lg border-2 border-slate-400 px-4 py-3 text-lg font-bold focus:border-[#00677F] focus:outline-none"
                        value={form.fecha}
                        onChange={(e) =>
                            setForm({ ...form, fecha: e.target.value })
                        }
                    />
                </div>
            </div>

            {/* MEDICAMENTOS EN COLUMNAS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MEDICAMENTOS.map((med) => {
                    const m = form.medicamentos[med];
                    const completo = m.inicio !== null && m.final !== null;

                    return (
                        <div
                            key={med}
                            onClick={() => setActivo(med)}
                            className="cursor-pointer rounded-xl border-2 border-slate-300 bg-white p-4 shadow transition hover:border-[#00677F] hover:bg-slate-50"
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="font-extrabold text-slate-700">
                                    {med}
                                </h3>
                                <span className="text-xl">
                                    {completo ? <Check /> : <Hourglass />}
                                </span>
                            </div>

                            <div className="text-sm text-slate-600">
                                Inicio: <b>{m.inicio ?? "—"}</b>
                                <br />
                                Final: <b>{m.final ?? "—"}</b>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL MEDICAMENTO */}
            {activo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="mb-6 text-center text-lg font-extrabold uppercase tracking-wide text-[#00677F]">
                            {activo}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-extrabold uppercase text-blue-700">
                                    Inicio del día
                                </label>
                                <input
                                    id="inicio"
                                    type="number"
                                    defaultValue={form.medicamentos[activo].inicio ?? 0}
                                    onFocus={(e) => {
                                        if (e.target.value === "0") e.target.value = "";
                                    }}
                                    className="w-full rounded-md border-2 border-blue-400 px-4 py-3 text-center text-lg font-extrabold"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-extrabold uppercase text-green-700">
                                    Final del día
                                </label>
                                <input
                                    id="final"
                                    type="number"
                                    defaultValue={form.medicamentos[activo].final ?? 0}
                                    onFocus={(e) => {
                                        if (e.target.value === "0") e.target.value = "";
                                    }}
                                    className="w-full rounded-md border-2 border-green-500 px-4 py-3 text-center text-lg font-extrabold"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setActivo(null)}
                                className="rounded-md border px-6 py-2 font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const inicio = Number(
                                        (document.getElementById("inicio") as HTMLInputElement).value
                                    );
                                    const final = Number(
                                        (document.getElementById("final") as HTMLInputElement).value
                                    );

                                    if (final > inicio) {
                                        alert("Final no puede ser mayor que Inicio");
                                        return;
                                    }

                                    guardarMedicamento(activo, inicio, final);
                                }}
                                className="rounded-md bg-[#00677F] px-8 py-2 font-bold text-white hover:bg-[#00586D]"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GUARDAR */}
            <div className="flex justify-end">
                <button
                    onClick={intentarGuardar}
                    className="rounded-lg bg-[#00677F] px-10 py-3 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-[#00586D]"
                >
                    Guardar Control del Día
                </button>
            </div>

            {/* MODAL FIRMA */}
            {mostrarFirma && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="mb-4 text-center text-lg font-extrabold uppercase text-[#00677F]">
                            Firma de Validación
                        </h3>
                        <FirmaBox
                            label={
                                isEdit && form.firma && !form.firma.startsWith("data:image")
                                    ? "Firma registrada (tocar para reemplazar)"
                                    : "Firma de Validación"
                            }
                            value={form.firma}
                            onClick={() => setOpenFirma("firma_responsable")}
                        />
                        <FirmaCanvas
                            open={openFirma === "firma_responsable"}
                            title="Firma de Validación"
                            value={form.firma}
                            onClose={() => setOpenFirma(null)}
                            onChange={(b64: string) =>
                                setForm(prev => ({
                                    ...prev,
                                    firma: b64,
                                }))
                            }
                        />

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setMostrarFirma(false)}
                                className="rounded-md border px-6 py-2 font-bold"
                            >
                                Cancelar
                            </button>
                            <button onClick={confirmarGuardar} className="rounded-lg bg-[#00677F] px-10 py-3 text-white">
                                {isEdit ? 'Actualizar Control del Día' : 'Guardar Control del Día'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
