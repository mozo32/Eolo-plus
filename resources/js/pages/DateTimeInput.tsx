import { useEffect, useState } from "react";

interface DateTimeModalSliderInputProps {
    label: string;
    name: string;
    value?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
    disabled?: boolean;
}

/**
 * Convierte:
 * 2026-01-30T23:59:00.000000Z
 * a:
 * 30/01/2026 23:59
 */
const formatFechaHora = (fecha?: string) => {
    if (!fecha) return "";

    const match = fecha.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

    if (!match) return "";

    const [, y, m, d, h, min] = match;
    return `${d}/${m}/${y} ${h}:${min}`;
};

export default function DateTimeModalSliderInput({
    label,
    name,
    value,
    onChange,
    required = false,
    disabled = false,
}: DateTimeModalSliderInputProps) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState("");
    const [hour, setHour] = useState(0);
    const [minute, setMinute] = useState(0);

    /**
     * Inicializa el modal con el valor actual (si existe)
     */
    useEffect(() => {
        if (!open || !value) return;

        const match = value.match(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
        );

        if (!match) return;

        const [, y, m, d, h, min] = match;

        setDate(`${y}-${m}-${d}`);
        setHour(Number(h));
        setMinute(Number(min));
    }, [open, value]);

    const handleConfirm = () => {
        if (!date) return;

        const finalValue = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

        onChange({
            target: { name, value: finalValue },
        } as React.ChangeEvent<HTMLInputElement>);

        setOpen(false);
    };

    return (
        <>
            {/* ================= INPUT VISIBLE ================= */}
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">
                    {label}
                </label>

                <input
                    type="text"
                    readOnly
                    value={formatFechaHora(value)}
                    onClick={() => !disabled && setOpen(true)}
                    required={required}
                    className={`
                        w-full border rounded-lg px-3 py-2 text-sm
                        cursor-pointer bg-white
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}
                    `}
                    placeholder="Seleccionar fecha y hora (24 h)"
                />
            </div>

            {/* ================= MODAL ================= */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-6">

                        <h3 className="text-lg font-bold text-center">
                            Fecha y hora (24 h)
                        </h3>

                        {/* Fecha */}
                        <div>
                            <label className="text-xs font-semibold text-gray-600">
                                Fecha
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full border rounded p-2"
                            />
                        </div>

                        {/* Vista previa */}
                        <div className="text-center text-3xl font-mono">
                            {String(hour).padStart(2, "0")}:
                            {String(minute).padStart(2, "0")}
                        </div>

                        {/* Slider hora */}
                        <div>
                            <label className="text-xs font-semibold text-gray-600">
                                Hora
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={23}
                                value={hour}
                                onChange={(e) => setHour(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        {/* Slider minutos */}
                        <div>
                            <label className="text-xs font-semibold text-gray-600">
                                Minutos
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={59}
                                value={minute}
                                onChange={(e) => setMinute(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        {/* Botones */}
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 text-sm rounded border"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm rounded bg-blue-600 text-white"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
