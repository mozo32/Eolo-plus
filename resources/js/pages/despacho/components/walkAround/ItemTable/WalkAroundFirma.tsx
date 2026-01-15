import React, { useState } from "react";
import SignaturePadModal from "../SignaturePadModal";
import Swal from "sweetalert2";
import { updateFirmaWalkaroundApi } from "@/stores/apiWalkaround";

type Props = {
    initialData: {
        id: number;
        responsable: string;
        jefeArea: string;
        fbo: string;
        firmaResponsableBase64?: string;
        firmaJefeAreaBase64?: string;
        firmaFboBase64?: string;
    };
    onClose: () => void;
    onSaved?: (data: any) => void;
};

type RolFirma = "responsable" | "jefe" | "fbo";

export default function WalkAroundFirma({ initialData, onClose, onSaved }: Props) {
    const [form, setForm] = useState(initialData);
    const [openFirma, setOpenFirma] = useState<RolFirma | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.firmaResponsableBase64) {
            Swal.fire("Falta firma", "El responsable debe firmar", "warning");
            return;
        }

        try {
            setSaving(true);
            await updateFirmaWalkaroundApi(form.id, form);

            await Swal.fire({
                icon: "success",
                title: "WalkAround firmado correctamente",
            });

            onSaved?.(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const FirmaCard = ({
        label,
        rol,
        nombre,
        firma,
        onNombreChange,
    }: {
        label: string;
        rol: RolFirma;
        nombre: string;
        firma?: string;
        onNombreChange: (v: string) => void;
    }) => (
        <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{label}</h3>
                <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold
                        ${firma
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                >
                    {firma ? "Firmado" : "Pendiente"}
                </span>
            </div>

            <input
                value={nombre}
                onChange={(e) => onNombreChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder={`Nombre ${label}`}
            />

            {firma && (
                <img
                    src={firma}
                    className="h-16 w-full rounded-md border bg-white object-contain p-1"
                />
            )}

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setOpenFirma(rol)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                    {firma ? "Reemplazar firma" : "Firmar"}
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold">Firmas del WalkAround</h2>

            <div className="grid gap-4 md:grid-cols-3">
                <FirmaCard
                    label="Responsable"
                    rol="responsable"
                    nombre={form.responsable}
                    firma={form.firmaResponsableBase64}
                    onNombreChange={(v) =>
                        setForm((p) => ({ ...p, responsable: v }))
                    }
                />

                <FirmaCard
                    label="Jefe de área"
                    rol="jefe"
                    nombre={form.jefeArea}
                    firma={form.firmaJefeAreaBase64}
                    onNombreChange={(v) =>
                        setForm((p) => ({ ...p, jefeArea: v }))
                    }
                />

                <FirmaCard
                    label="VoBo FBO"
                    rol="fbo"
                    nombre={form.fbo}
                    firma={form.firmaFboBase64}
                    onNombreChange={(v) =>
                        setForm((p) => ({ ...p, fbo: v }))
                    }
                />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-sm"
                >
                    Cancelar
                </button>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`rounded-lg px-5 py-2 text-sm font-semibold text-white
                        ${saving
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-primary hover:opacity-90"
                        }`}
                >
                    {saving ? "Guardando..." : "Guardar firmas"}
                </button>
            </div>

            <SignaturePadModal
                open={openFirma === "responsable"}
                title="Firma Responsable"
                value={form.firmaResponsableBase64 ?? ""}
                onClose={() => setOpenFirma(null)}
                onChange={(b64) =>
                    setForm((p) => ({ ...p, firmaResponsableBase64: b64 }))
                }
            />

            <SignaturePadModal
                open={openFirma === "jefe"}
                title="Firma Jefe de área"
                value={form.firmaJefeAreaBase64 ?? ""}
                onClose={() => setOpenFirma(null)}
                onChange={(b64) =>
                    setForm((p) => ({ ...p, firmaJefeAreaBase64: b64 }))
                }
            />

            <SignaturePadModal
                open={openFirma === "fbo"}
                title="Firma VoBo FBO"
                value={form.firmaFboBase64 ?? ""}
                onClose={() => setOpenFirma(null)}
                onChange={(b64) =>
                    setForm((p) => ({ ...p, firmaFboBase64: b64 }))
                }
            />
        </div>
    );
}
