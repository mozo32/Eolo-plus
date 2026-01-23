import { useState } from "react";
import FirmaCanvas from "@/pages/FirmaCanvas";
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
type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function Firmas({ form, updateField }: Props) {
    const [openFirma, setOpenFirma] = useState<
        null | "quien_entrega" | "jefe_rampa" | "quien_recibe"
    >(null);

    return (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-6 border-b pb-2 text-sm font-bold uppercase text-orange-600">
                Firmas
            </h3>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* QUIEN ENTREGA */}
                <FirmaBox
                    label="Firma quien entrega"
                    value={form.firmas?.quienEntrega}
                    onClick={() => setOpenFirma("quien_entrega")}
                />

                {/* JEFE RAMPA */}
                <FirmaBox
                    label="Enterado Jefe de Rampa"
                    value={form.firmas?.jefeRampa}
                    onClick={() => setOpenFirma("jefe_rampa")}
                />

                {/* QUIEN RECIBE */}
                <FirmaBox
                    label="Firma quien recibe"
                    value={form.firmas?.quienRecibe}
                    onClick={() => setOpenFirma("quien_recibe")}
                />
            </div>

            {/* MODALES */}
            <FirmaCanvas
                open={openFirma === "quien_entrega"}
                title="Firma quien entrega"
                value={form.firmas?.quienEntrega}
                onClose={() => setOpenFirma(null)}
                onChange={(b64: string) =>
                    updateField("firmas.quienEntrega", b64)
                }
            />

            <FirmaCanvas
                open={openFirma === "jefe_rampa"}
                title="Enterado Jefe de Rampa"
                value={form.firmas?.jefeRampa}
                onClose={() => setOpenFirma(null)}
                onChange={(b64: string) =>
                    updateField("firmas.jefeRampa", b64)
                }
            />

            <FirmaCanvas
                open={openFirma === "quien_recibe"}
                title="Firma quien recibe"
                value={form.firmas?.quienRecibe}
                onClose={() => setOpenFirma(null)}
                onChange={(b64: string) =>
                    updateField("firmas.quienRecibe", b64)
                }
            />
        </div>
    );
}
