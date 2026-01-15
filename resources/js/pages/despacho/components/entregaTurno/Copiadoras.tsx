import React from "react";

export type FuncionEstado = "si" | "no" | "";
export type TonerEstado = "bueno" | "malo" | "";

export interface CopiadorasState {
    funciona: FuncionEstado;
    toner: TonerEstado;
    paquetes: number | '';
    fallas: string;
}

interface CopiadorasProps {
    value: CopiadorasState;
    onChange: (next: CopiadorasState) => void;
}

const Copiadoras: React.FC<CopiadorasProps> = ({ value, onChange }) => {
    const update = (field: keyof CopiadorasState, val: any) => {
        onChange({ ...value, [field]: val });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Revisión de copiadoras
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Indique el estado general de las copiadoras y el material disponible.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* FUNCIONA */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        ¿La copiadora funciona?
                    </label>
                    <div className="mt-1 flex items-center gap-6 text-sm">
                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="funciona"
                                value="si"
                                checked={value.funciona === "si"}
                                onChange={() => update("funciona", "si")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">Sí</span>
                        </label>

                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="funciona"
                                value="no"
                                checked={value.funciona === "no"}
                                onChange={() => update("funciona", "no")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">No</span>
                        </label>
                    </div>
                </div>

                {/* TONER */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Estado del tóner
                    </label>
                    <div className="mt-1 flex items-center gap-6 text-sm">
                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="toner"
                                value="bueno"
                                checked={value.toner === "bueno"}
                                onChange={() => update("toner", "bueno")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">Bueno</span>
                        </label>

                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="toner"
                                value="malo"
                                checked={value.toner === "malo"}
                                onChange={() => update("toner", "malo")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">Malo</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* PAQUETES DE HOJAS */}
            <div className="grid gap-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Paquetes de hojas disponibles
                </label>
                <input
                    type="number"
                    value={value.paquetes}
                    onChange={(e) =>
                        update(
                            "paquetes",
                            e.target.value === "" ? "" : Number(e.target.value)
                        )
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                        outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="0"
                />
            </div>

            {/* FALLAS */}
            <div className="grid gap-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Fallas en las copiadoras
                </label>
                <textarea
                    value={value.fallas}
                    onChange={(e) => update("fallas", e.target.value)}
                    className="min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                        outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Describa fallas si existen..."
                />
            </div>
        </div>
    );
};

export default Copiadoras;
