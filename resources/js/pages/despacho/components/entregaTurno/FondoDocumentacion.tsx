import React from "react";
import { OperacionesDiarias, WalkAround } from "@/stores/apiEntregarTurno";
import { useEffect } from "react";

export type FuncionReporteAterisaje = "si" | "no" | "";
export type NumeroVacio = number | "";

export interface FondoDocumentacionItem {
    fondoRecibido: NumeroVacio;
    gastos: NumeroVacio[];
    cantidadValesGasolina: NumeroVacio;
    folioValesGasolina: string[]; // Ahora es un arreglo de strings para múltiples folios
    fondoEntregado: NumeroVacio;
    reporteAterisaje: FuncionReporteAterisaje;
    cantidadReporteAterisaje: NumeroVacio;
    totalLlegadaOperacion: NumeroVacio;
    totalSalidaOperacion: NumeroVacio;
    cantidadOperacionesCordinadasEntregadas: NumeroVacio;
    cuantosWalkArounds: NumeroVacio;
}

export type FondoDocumentacionState = FondoDocumentacionItem;

export const FONDO_DOC_DEFAULT: FondoDocumentacionState = {
    fondoRecibido: "",
    gastos: [],
    cantidadValesGasolina: "",
    fondoEntregado: "",
    folioValesGasolina: [], // Inicia como arreglo vacío
    reporteAterisaje: "",
    cantidadReporteAterisaje: "",
    totalLlegadaOperacion: "",
    totalSalidaOperacion: "",
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
        const nextState = { ...value, [field]: val };

        // Lógica de cálculo de fondo entregado
        if (field === "fondoRecibido" || field === "gastos") {
            const recibido = Number(nextState.fondoRecibido) || 0;
            const totalGastos = (nextState.gastos || []).reduce<number>(
                (sum, gasto) => sum + (Number(gasto) || 0),
                0
            );
            nextState.fondoEntregado = recibido - totalGastos;
        }

        // Lógica para ajustar los folios de vales cuando cambia la cantidad
        if (field === "cantidadValesGasolina") {
            const nuevaCantidad = Number(val) || 0;
            const foliosActuales = [...(nextState.folioValesGasolina || [])];

            // Si la nueva cantidad es mayor, agregamos espacios vacíos al final
            if (nuevaCantidad > foliosActuales.length) {
                const faltantes = nuevaCantidad - foliosActuales.length;
                for (let i = 0; i < faltantes; i++) {
                    foliosActuales.push("");
                }
            }
            // Si la nueva cantidad es menor, recortamos el arreglo
            else if (nuevaCantidad < foliosActuales.length) {
                foliosActuales.splice(nuevaCantidad);
            }

            nextState.folioValesGasolina = foliosActuales;
        }

        onChange(nextState);
    };

    // --- MANEJO DE GASTOS ---
    const handleAddGasto = () => {
        const nuevosGastos = [...(value.gastos || []), ""];
        update("gastos", nuevosGastos as NumeroVacio[]);
    };

    const handleUpdateGasto = (index: number, val: string) => {
        const nuevosGastos = [...(value.gastos || [])];
        nuevosGastos[index] = toNumeroVacio(val);
        update("gastos", nuevosGastos as NumeroVacio[]);
    };

    const handleRemoveGasto = (index: number) => {
        const nuevosGastos = (value.gastos || []).filter((_, i) => i !== index);
        update("gastos", nuevosGastos as NumeroVacio[]);
    };

    // --- MANEJO DE FOLIOS DE VALES ---
    const handleUpdateFolio = (index: number, val: string) => {
        const nuevosFolios = [...(value.folioValesGasolina || [])];
        nuevosFolios[index] = val; // Mantenemos como string
        update("folioValesGasolina", nuevosFolios);
    };

    // --- CARGA INICIAL DE DATOS ---
    const cargarDatosIniciales = async () => {
        if (
            value.totalLlegadaOperacion !== "" ||
            value.totalSalidaOperacion !== "" ||
            value.cuantosWalkArounds !== ""
        ) {
            return;
        }

        try {
            const [resOperaciones, resWalkArounds] = await Promise.all([
                OperacionesDiarias(),
                WalkAround()
            ]);

            const actualizaciones: Partial<FondoDocumentacionState> = {};

            if (resOperaciones) {
                actualizaciones.totalLlegadaOperacion = resOperaciones.llegadas ?? "";
                actualizaciones.totalSalidaOperacion = resOperaciones.salidas ?? "";
            }

            if (resWalkArounds) {
                actualizaciones.cuantosWalkArounds = resWalkArounds.total ?? "";
            }

            onChange({
                ...value,
                ...actualizaciones
            });

        } catch (e: any) {
            console.error("Error al cargar datos iniciales:", e);
        }
    };

    useEffect(() => {
        cargarDatosIniciales();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Fondo y Documentación
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registro de fondos, gastos y documentos
                </p>
            </div>

            {/* SECCIÓN 1: FINANZAS (Fondo y Gastos) */}
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Finanzas
                </h4>

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
                                dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            placeholder="Monto Recibido"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Fondo Entregado (Calculado)
                        </label>
                        <input
                            type="number"
                            readOnly
                            value={value.fondoEntregado}
                            className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600
                                outline-none cursor-not-allowed
                                dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                            placeholder="Fondo - Gastos"
                        />
                    </div>
                </div>

                {/* Área exclusiva para los gastos en Grid */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Registro de Gastos
                        </label>
                        <button
                            type="button"
                            onClick={handleAddGasto}
                            className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                        >
                            <span>+</span> Agregar Gasto
                        </button>
                    </div>

                    {(!value.gastos || value.gastos.length === 0) ? (
                        <div className="rounded-md border border-dashed border-gray-300 py-4 text-center dark:border-gray-600">
                            <p className="text-xs text-gray-400 dark:text-gray-500">Sin gastos registrados</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {value.gastos.map((gasto, idx) => (
                                <div key={idx} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <span className="pl-2 text-xs font-medium text-gray-400">#{idx + 1}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={gasto}
                                        onChange={(e) => handleUpdateGasto(idx, e.target.value)}
                                        className="w-full border-none bg-transparent px-2 py-1 text-sm outline-none ring-0 focus:ring-0 dark:text-white"
                                        placeholder="Cantidad..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveGasto(idx)}
                                        className="rounded px-2 py-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                                        title="Eliminar gasto"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: VALES DE GASOLINA */}
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Vales de gasolina - Cantidad
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={value.cantidadValesGasolina}
                            onChange={(e) => update("cantidadValesGasolina", toNumeroVacio(e.target.value))}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Ingrese cuántos vales entregó"
                        />
                    </div>

                    {/* Generación dinámica de inputs de Folios */}
                    {value.folioValesGasolina && value.folioValesGasolina.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                Ingrese los Folios
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {value.folioValesGasolina.map((folio, index) => (
                                    <div key={index} className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Folio {index + 1}</span>
                                        <input
                                            type="text"
                                            value={folio}
                                            onChange={(e) => handleUpdateFolio(index, e.target.value)}
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm
                                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            placeholder={`Folio #${index + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 3: OPERACIONES Y REPORTES */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 border-t border-gray-200 pt-4 dark:border-gray-700">

                {/* Bloque Izquierdo: Operaciones */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Total de operaciones (Llegadas / Salidas)
                        </label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <input
                                type="number"
                                min={0}
                                value={value.totalLlegadaOperacion}
                                onChange={(e) => update("totalLlegadaOperacion", toNumeroVacio(e.target.value))}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                    outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                    dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                placeholder="Llegadas"
                            />
                            <input
                                type="number"
                                min={0}
                                value={value.totalSalidaOperacion}
                                onChange={(e) => update("totalSalidaOperacion", toNumeroVacio(e.target.value))}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                    outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                    dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                placeholder="Salidas"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Operaciones coordinadas entregadas
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={value.cantidadOperacionesCordinadasEntregadas}
                            onChange={(e) => update("cantidadOperacionesCordinadasEntregadas", toNumeroVacio(e.target.value))}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Cantidad"
                        />
                    </div>
                </div>

                {/* Bloque Derecho: Reportes y Walk-Arounds */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Reporte de Aterrizajes
                        </label>
                        <div className="mt-1 flex items-center gap-6 text-sm mb-2">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
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

                            <label className="inline-flex items-center gap-1 cursor-pointer">
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
                            onChange={(e) => update("cantidadReporteAterisaje", toNumeroVacio(e.target.value))}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Cantidad de reportes"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            Walk-Arounds ¿Cuántos?
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={value.cuantosWalkArounds}
                            onChange={(e) => update("cuantosWalkArounds", toNumeroVacio(e.target.value))}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Cantidad"
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FondoDocumentacion;
