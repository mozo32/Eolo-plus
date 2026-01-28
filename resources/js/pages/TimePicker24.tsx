import { useEffect, useState } from "react";

type Props = {
    value: string; // HH:mm
    onChange: (value: string) => void;
    label?: string;
};

export default function TimePicker24({
    value,
    onChange,
    label,
}: Props) {
    const [raw, setRaw] = useState(""); // HHMM sin :

    useEffect(() => {
        if (value) {
            setRaw(value.replace(":", ""));
        }
    }, [value]);

    useEffect(() => {
        if (raw.length === 4) {
            let h = Number(raw.slice(0, 2));
            let m = Number(raw.slice(2, 4));

            if (h > 23) h = 23;
            if (m > 59) m = 59;

            const hh = String(h).padStart(2, "0");
            const mm = String(m).padStart(2, "0");

            onChange(`${hh}:${mm}`);
        }
    }, [raw]);

    const press = (n: string) => {
        if (raw.length < 4) setRaw(raw + n);
    };

    const clear = () => setRaw("");

    const del = () => setRaw(raw.slice(0, -1));

    return (
        <div>
            {label && (
                <label className="mb-1 block text-xs font-extrabold uppercase text-slate-600">
                    {label}
                </label>
            )}

            <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-4 shadow-sm">
                {/* DISPLAY */}
                <div className="mb-4 text-center text-3xl font-extrabold tracking-widest text-[#00677F]">
                    {raw.padEnd(4, "•").replace(/(\d{2})(\d{2})/, "$1:$2")}
                </div>

                {/* KEYPAD */}
                <div className="grid grid-cols-3 gap-2">
                    {["1","2","3","4","5","6","7","8","9"].map((n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => press(n)}
                            className="rounded-lg bg-white py-3 text-lg font-bold hover:bg-slate-200"
                        >
                            {n}
                        </button>
                    ))}

                    <button
                        type="button"
                        onClick={clear}
                        className="rounded-lg bg-red-100 py-3 text-sm font-bold text-red-600 hover:bg-red-200"
                    >
                        C
                    </button>

                    <button
                        type="button"
                        onClick={() => press("0")}
                        className="rounded-lg bg-white py-3 text-lg font-bold hover:bg-slate-200"
                    >
                        0
                    </button>

                    <button
                        type="button"
                        onClick={del}
                        className="rounded-lg bg-slate-200 py-3 text-sm font-bold hover:bg-slate-300"
                    >
                        ←
                    </button>
                </div>

                <div className="mt-3 text-center text-xs font-bold text-slate-500">
                    Ingresa HHMM (24 horas)
                </div>
            </div>
        </div>
    );
}
