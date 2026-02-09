import { useMatriculaAutocompleteStore } from "@/stores/useMatriculaAutocompleteStore";
import DateTimeModalSliderInput from "@/pages/DateTimeInput";
import InputMatricula from "@/pages/InputMatricula";
import { useEffect, useState } from "react";
import FirmaCanvas from "@/pages/FirmaCanvas";

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
export default function MovimientoCSAEEntrada({ data, onChange, updateField }: Props) {
    const { tipoAeronave } = useMatriculaAutocompleteStore();
    const [openFirma, setOpenFirma] = useState<
        null | "firma_entrada"
    >(null);
    useEffect(() => {
        if (tipoAeronave) {
            onChange({
                target: {
                    name: "tipo_aeronave",
                    value: tipoAeronave,
                },
            } as React.ChangeEvent<HTMLInputElement>);
        }
    }, [tipoAeronave]);

    return (
        <section className="bg-gray-50 border border-gray-300 rounded-lg p-6 space-y-6">

            <header className="text-center">
                <h2 className="text-lg font-bold">
                    AVIONES DE CSAE GUARDA
                </h2>
                <p className="text-sm text-gray-600">
                    Registro de entrada
                </p>
            </header>

            {/* Bloque 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <DateTimeModalSliderInput
                        label="Fecha y hora de entrada"
                        name="fecha_hora_entrada"
                        value={data.fecha_hora_entrada}
                        onChange={onChange}
                        required
                    />
                </div>

                <div>
                    <InputMatricula
                        label="Matrícula"
                        value={data.matricula}
                        required
                        onSelect={(value) =>
                            onChange({
                                target: {
                                    name: "matricula",
                                    value,
                                },
                            } as React.ChangeEvent<HTMLInputElement>)
                        }
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase">
                        Tipo de Aeronave
                    </label>
                    <input
                        type="text"
                        name="tipo_aeronave"
                        value={data.tipo_aeronave}
                        onChange={(e) => {
                            e.target.value = e.target.value.toUpperCase();
                            onChange(e);
                        }}
                        className="w-full border rounded p-2 mt-1 uppercase"
                    />
                </div>
            </div>

            {/* Bloque 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-semibold uppercase">
                        Cómo llega
                    </label>
                    <input
                        type="text"
                        name="como_llega"
                        value={data.como_llega}
                        onChange={onChange}
                        className="w-full border rounded p-2 mt-1"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase">
                        Transportista
                    </label>
                    <input
                        type="text"
                        name="transportista"
                        value={data.transportista}
                        onChange={onChange}
                        className="w-full border rounded p-2 mt-1"
                    />
                </div>
            </div>

            {/* Observaciones */}
            <div>
                <label className="block text-xs font-semibold uppercase">
                    Observaciones de entrada
                </label>
                <textarea
                    name="observaciones_entrada"
                    rows={3}
                    value={data.observaciones_entrada}
                    onChange={onChange}
                    className="w-full border rounded p-2 mt-1"
                />
            </div>
            <div>
                <label className="block text-xs font-semibold uppercase">
                    Quien Recibe
                </label>
                <input
                    type="text"
                    name="quien_recibe"
                    value={data.quien_recibe}
                    onChange={onChange}
                    className="w-full border rounded p-2 mt-1"
                />
            </div>
            <div>
                <FirmaBox
                    label="Firma de Recibido"
                    value={data.firma_entrada}
                    onClick={() => setOpenFirma("firma_entrada")}
                />
                <FirmaCanvas
                    open={openFirma === "firma_entrada"}
                    title="Firma de salida"
                    value={data.firma_entrada}
                    onClose={() => setOpenFirma(null)}
                    onChange={(b64: string) =>
                        updateField("firma_entrada", b64)
                    }
                />
            </div>
        </section>
    );
}
