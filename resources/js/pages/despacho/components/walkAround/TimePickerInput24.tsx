import React, { useEffect, useRef, useState } from "react";

interface Props {
    value: string;
    onChange: (value: string) => void;
}

const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
);

const minutes = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0")
);

export default function TimePickerInput24({ value, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [selecting, setSelecting] = useState<"hour" | "minute">("hour");
    const ref = useRef<HTMLDivElement>(null);

    const [h = "00", m = "00"] = value?.split(":") ?? [];

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setSelecting("hour");
            }
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const selectHour = (hour: string) => {
        onChange(`${hour}:${m}`);
        setSelecting("minute");
    };

    const selectMinute = (minute: string) => {
        onChange(`${h}:${minute}`);
        setOpen(false);
        setSelecting("hour");
    };

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                readOnly
                value={value || ""}
                onClick={() => setOpen((o) => !o)}
                placeholder="HH:mm"
                className="h-11 w-full cursor-pointer rounded-lg border px-3 text-base
                    bg-white dark:bg-gray-900 dark:text-white"
            />

            {open && (
                <div className="absolute z-50 mt-2 w-[280px] rounded-xl border bg-white p-4 shadow-xl
                    dark:border-gray-700 dark:bg-gray-900"
                >
                    <div className="mb-3 flex justify-center gap-2 text-sm font-semibold">
                        <button
                            type="button"
                            onClick={() => setSelecting("hour")}
                            className={`rounded px-3 py-1
                                ${selecting === "hour"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-800"
                                }`}
                        >
                            Hora
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelecting("minute")}
                            className={`rounded px-3 py-1
                                ${selecting === "minute"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-800"
                                }`}
                        >
                            Minutos
                        </button>
                    </div>

                    {selecting === "hour" && (
                        <div className="grid grid-cols-6 gap-2">
                            {hours.map((hour) => (
                                <button
                                    key={hour}
                                    type="button"
                                    onClick={() => selectHour(hour)}
                                    className={`rounded-lg py-2 text-sm font-mono
                                        ${hour === h
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    {hour}
                                </button>
                            ))}
                        </div>
                    )}

                    {selecting === "minute" && (
                        <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                            {minutes.map((minute) => (
                                <button
                                    key={minute}
                                    type="button"
                                    onClick={() => selectMinute(minute)}
                                    className={`rounded-lg py-2 text-sm font-mono
                                        ${minute === m
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    {minute}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
