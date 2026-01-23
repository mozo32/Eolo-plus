import React, { useEffect } from "react";
import SignaturePad from "./SignaturePad";

type SignaturePadModalProps = {
    open: boolean;
    title: string;
    value: string; // base64
    onClose: () => void;
    onChange: (base64: string) => void;
};

export default function FirmaCanvas({
    open,
    title,
    value,
    onClose,
    onChange,
}: SignaturePadModalProps) {
    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Dibuja con mouse o touch
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <SignaturePad
                        title="" // ya lo mostramos arriba
                        value={value}
                        onChange={onChange}
                        compact
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
