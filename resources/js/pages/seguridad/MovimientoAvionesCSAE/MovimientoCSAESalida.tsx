import DateTimeModalSliderInput from "@/pages/DateTimeInput";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { useState } from "react";

interface Props {
    data: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateField: (key: string, value: any) => void;
}
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
const formatFechaHora = (fecha?: string | null) => {
    if (!fecha) return "—";

    const [fechaParte, horaParte] = fecha.split("T");

    if (!fechaParte || !horaParte) return "—";

    const [y, m, d] = fechaParte.split("-");
    const hora = horaParte.slice(0, 5); // HH:mm

    return `${d}/${m}/${y} ${hora}`;
};
export default function MovimientoCSAESalida({ data, onChange, updateField }: Props) {
    const [openFirma, setOpenFirma] = useState<
        null | "firma_salida"
    >(null);

    return (
        <section className="space-y-8">
            <div className="border-l-4 border-blue-600 bg-white p-5 rounded shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">
                    Datos de entrada
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">Fecha / Hora</span>
                        <p className="font-medium">
                            {formatFechaHora(data.fecha_hora_entrada)}
                        </p>
                    </div>

                    <div>
                        <span className="text-gray-500">Matrícula</span>
                        <p className="font-semibold tracking-wide">
                            {data.matricula || "—"}
                        </p>
                    </div>

                    <div>
                        <span className="text-gray-500">Tipo</span>
                        <p className="font-medium">
                            {data.tipo_aeronave || "—"}
                        </p>
                    </div>

                    <div>
                        <span className="text-gray-500">Firma entrada</span>
                        <div className="font-medium">
                            <img
                                src={data.firma_entrada}
                                alt="Firma de entrada"
                                className="h-16 object-contain border rounded bg-white p-1"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <DateTimeModalSliderInput
                        label="Fecha y hora de salida"
                        name="fecha_hora_salida"
                        value={data.fecha_hora_salida}
                        onChange={onChange}
                        required
                    />

                    <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                            Firma
                        </label>
                        <FirmaBox
                            label="Firma de Recibido"
                            value={data.firma_salida}
                            onClick={() => setOpenFirma("firma_salida")}
                        />
                        <FirmaCanvas
                            open={openFirma === "firma_salida"}
                            title="Firma de salida"
                            value={data.firma_salida}
                            onClose={() => setOpenFirma(null)}
                            onChange={(b64: string) =>
                                updateField("firma_salida", b64)
                            }
                        />
                    </div>
                </div>
                <div className="h-full flex flex-col">
                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                        Observaciones de salida
                    </label>
                    <textarea
                        name="observaciones_salida"
                        placeholder="Observaciones de salida"
                        value={data.observaciones_salida}
                        onChange={onChange}
                        className="w-full flex-1 resize-none border rounded p-2"
                    />
                </div>
            </div>
        </section>
    );
}
