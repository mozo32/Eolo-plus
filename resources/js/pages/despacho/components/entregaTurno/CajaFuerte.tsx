import React from "react";

interface CajaFuerteProps {
    value: string;
    onChange: (value: string) => void;
}

const CajaFuerte: React.FC<CajaFuerteProps> = ({ value, onChange }) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Estado de la caja fuerte
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Describa el estado actual de la caja fuerte al cierre del turno.
                    </p>
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="min-h-[90px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                    outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                    dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Ej. Caja fuerte cerrada con llave, fondos completos, sin novedades..."
            />
        </div>
    );
};

export default CajaFuerte;
