import React from "react";

export type FuncionReporteAterisaje = "si" | "no" | "";
export type NumeroVacio = number | "";

export interface FondoDocumentacionItem {
    fondoRecibido: NumeroVacio;
    cantidadValesGasolina: NumeroVacio;
    fondoEntregado: NumeroVacio;
    folioValesGasolina: NumeroVacio;
    reporteAterisaje: FuncionReporteAterisaje;
    cantidadReporteAterisaje: NumeroVacio;
    totalLlegadaOperacion: NumeroVacio;
    totalSalidaOperacion: NumeroVacio;
    reportesEnviadosCorreo: string;
    cantidadOperacionesCordinadasEntregadas: NumeroVacio;
    cuantosWalkArounds: NumeroVacio;
}

export type FondoDocumentacionState = FondoDocumentacionItem;

export const FONDO_DOC_DEFAULT: FondoDocumentacionState = {
    fondoRecibido: "",
    cantidadValesGasolina: "",
    fondoEntregado: "",
    folioValesGasolina: "",
    reporteAterisaje: "",
    cantidadReporteAterisaje: "",
    totalLlegadaOperacion: "",
    totalSalidaOperacion: "",
    reportesEnviadosCorreo: "",
    cantidadOperacionesCordinadasEntregadas: "",
    cuantosWalkArounds: "",
};

interface FondoDocumentacionProps {
    value: FondoDocumentacionState;
    onChange: (next: FondoDocumentacionState) => void;
}

const toNumeroVacio = (val: string): NumeroVacio =>
    val === "" ? "" : Number(val);

const FondoDocumentacion: React.FC<FondoDocumentacionProps> = ({ value, onChange }) => {
    const update = <K extends keyof FondoDocumentacionState>(
        field: K,
        val: FondoDocumentacionState[K]
    ) => {
        onChange({ ...value, [field]: val });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Fondo y Documentación
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Registro de fondos y documentos
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Fondo Recibido
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.fondoRecibido}
                        onChange={(e) => update("fondoRecibido", toNumeroVacio(e.target.value))}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Monto Recibido"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Vales de gasolina - Cantidad
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.cantidadValesGasolina}
                        onChange={(e) =>
                            update("cantidadValesGasolina", toNumeroVacio(e.target.value))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Cantidad de ventas"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Fondo Entregado
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.fondoEntregado}
                        onChange={(e) => update("fondoEntregado", toNumeroVacio(e.target.value))}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Monto entregado"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Vales de gasolina - Folio
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.folioValesGasolina}
                        onChange={(e) =>
                            update("folioValesGasolina", toNumeroVacio(e.target.value))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Número de folio"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Reporte de Aterrizajes
                    </label>
                    <div className="mt-1 flex items-center gap-6 text-sm">
                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="reporteAterisaje"
                                value="si"
                                checked={value.reporteAterisaje === "si"}
                                onChange={() => update("reporteAterisaje", "si")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">Sí</span>
                        </label>

                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="reporteAterisaje"
                                value="no"
                                checked={value.reporteAterisaje === "no"}
                                onChange={() => update("reporteAterisaje", "no")}
                                className="h-4 w-4 border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                            />
                            <span className="text-gray-800 dark:text-gray-100">No</span>
                        </label>
                    </div>
                    <input
                        type="number"
                        min={0}
                        value={value.cantidadReporteAterisaje}
                        onChange={(e) =>
                            update("cantidadReporteAterisaje", toNumeroVacio(e.target.value))
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Cantidad"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Total de operaciones
                    </label>
                    <br />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="number"
                            min={0}
                            value={value.totalLlegadaOperacion}
                            onChange={(e) =>
                                update("totalLlegadaOperacion", toNumeroVacio(e.target.value))
                            }
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Llegadas"
                        />

                        <input
                            type="number"
                            min={0}
                            value={value.totalSalidaOperacion}
                            onChange={(e) =>
                                update("totalSalidaOperacion", toNumeroVacio(e.target.value))
                            }
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Salidas"
                        />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Reporte de operaciones enviadas por correo
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.reportesEnviadosCorreo}
                        onChange={(e) => update("reportesEnviadosCorreo", String(e.target.value))}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Descripción o cantidad"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        Cantidad de operaciones coordinadas entregadas
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.cantidadOperacionesCordinadasEntregadas}
                        onChange={(e) =>
                            update(
                                "cantidadOperacionesCordinadasEntregadas",
                                toNumeroVacio(e.target.value)
                            )
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                            outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                            dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="Cantidad"
                    />
                </div>
            </div>
            <div className="grid gap-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Walk-Arounds ¿Cuantos?
                </label>
                <input
                    type="number"
                    min={0}
                    value={value.cuantosWalkArounds}
                    onChange={(e) =>
                        update("cuantosWalkArounds", toNumeroVacio(e.target.value))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                        outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                        dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Cantidad"
                />
            </div>
        </div>
    );
};

export default FondoDocumentacion;
