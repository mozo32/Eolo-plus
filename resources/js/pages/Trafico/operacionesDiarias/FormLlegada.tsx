import { useState } from "react";
import Swal from "sweetalert2";
import { guardarOperacionesDiariasApi } from "@/stores/apiOperacionesDiarias";
import InputMatricula from "@/pages/InputMatricula";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";

export const FormLlegada = ({ alCerrar, moduloNombre, datosEdicion, soloLectura = false }: {
    alCerrar?: () => void,
    moduloNombre?: string,
    datosEdicion?: any,
    soloLectura?: boolean
}) => {
    const { obtenerTipo } = useMatriculaAutocompleteStore();

    const [formData, setFormData] = useState({
        id: datosEdicion?.id || null,
        matricula: datosEdicion?.matricula || '',
        equipo: datosEdicion?.equipo || '',
        hora: datosEdicion?.hora?.substring(0, 5) || '',
        procedencia: datosEdicion?.lugar || '',
        pax: datosEdicion?.pax || null,
        equipaje: datosEdicion?.equipaje || null,
        tipo_cliente: datosEdicion?.tipo_cliente || '',
        departamento: moduloNombre,
        movimiento: 'Llegada',
        fecha: datosEdicion?.fecha || new Date().toISOString().split('T')[0],
        observaciones: datosEdicion?.observaciones || '',
        nombre: datosEdicion?.nombre || '',
        impulso: datosEdicion?.impulso || ''
    });

    const handleFieldChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMatriculaSelect = async (matricula: string) => {
        const upperMat = matricula.toUpperCase();

        handleFieldChange("matricula", upperMat);

        if (upperMat.length > 2) {
            try {
                const response = await obtenerTipo(upperMat) as any;
                if (response && response.tipo) {
                    handleFieldChange("equipo", response.tipo);
                }
            } catch (error) {
                console.error("Error al obtener equipo:", error);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await guardarOperacionesDiariasApi(formData);
            Swal.fire({
                icon: 'success',
                title: datosEdicion ? 'Actualizado' : 'Guardado',
                text: 'La llegada se procesó con éxito',
                timer: 1500,
                showConfirmButton: false
            });
            if (alCerrar) alCerrar();
        } catch (error) {
            let mensaje = 'Ocurrió un error inesperado';

            if (error instanceof Error) {
                mensaje = error.message;
            }

            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: mensaje,
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border-t-8 border-blue-600 shadow-2xl w-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold mb-1 uppercase tracking-tight text-slate-800">
                        {datosEdicion ? 'Actualizar Llegada' : 'Nuevo Registro de Arribo'}
                    </h2>
                    <p className="text-sm text-slate-400">Complete los datos de arribo</p>
                </div>
                <button type="button" onClick={alCerrar} className="text-slate-300 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {soloLectura && (
                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg flex items-center gap-2">
                    <span>🔒 REGISTRO VALIDADO POR {moduloNombre?.toUpperCase()} - SOLO LECTURA</span>
                </div>
            )}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <InputMatricula
                        label="Matrícula"
                        value={formData.matricula}
                        onSelect={handleMatriculaSelect}
                        required
                        disabled={soloLectura}
                    />
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipo</label>
                        <input
                            type="text"
                            value={formData.equipo}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => handleFieldChange("equipo", e.target.value.toUpperCase())}
                            required
                            disabled={soloLectura}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Arribo (24h)</label>
                        <input
                            type="text"
                            placeholder="HH:MM"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            value={formData.hora}
                            maxLength={5}
                            required
                            disabled={soloLectura}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, "");
                                if (val.length >= 1 && parseInt(val[0]) > 2) val = "";
                                if (val.length >= 2 && parseInt(val.substring(0, 2)) > 23) val = "23" + val.substring(2);
                                if (val.length > 2) val = val.substring(0, 2) + ":" + val.substring(2, 4);
                                if (val.length === 5) {
                                    const mins = parseInt(val.substring(3, 5));
                                    if (mins > 59) val = val.substring(0, 3) + "59";
                                }
                                handleFieldChange("hora", val);
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Procedencia</label>
                        <input
                            type="text"
                            disabled={soloLectura}
                            value={formData.procedencia}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => handleFieldChange("procedencia", e.target.value.toUpperCase())}
                            required
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pax</label>
                        <input
                            type="number"
                            disabled={soloLectura}
                            value={formData.pax}
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => handleFieldChange("pax", parseInt(e.target.value) || 0)}
                        />
                    </div>
                    {moduloNombre === 'Trafico' && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipaje</label>
                            <input
                                type="text"
                                disabled={soloLectura}
                                value={formData.equipaje}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                onChange={(e) => handleFieldChange("equipaje", e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                    )}
                </div>
                {moduloNombre === 'Trafico' && (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Cliente</label>
                        <select
                            value={formData.tipo_cliente}
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            onChange={(e) => handleFieldChange("tipo_cliente", e.target.value)}
                            required
                            disabled={soloLectura}
                        >
                            <option value="">Seleccione una opción...</option>
                            <option value="TRAFICO">TRAFICO</option>
                            <option value="GUARDA">GUARDA</option>
                            <option value="AEROTAXI">AEROTAXI</option>
                        </select>
                    </div>
                )}
                {moduloNombre === 'Seguridad' && (
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-2">Tipo de Movimiento</label>
                            <div className="flex gap-8">
                                <label className="flex items-center cursor-pointer group">
                                    <input
                                        type="radio"
                                        disabled={soloLectura}
                                        name="impulso"
                                        value="Propio Impulso"
                                        checked={formData.impulso === 'Propio Impulso'}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-slate-700">Propio Impulso</span>
                                </label>
                                <label className="flex items-center cursor-pointer group">
                                    <input
                                        type="radio"
                                        disabled={soloLectura}
                                        name="impulso"
                                        value="Remolcado"
                                        checked={formData.impulso === 'Remolcado'}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-slate-700">Remolcado</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-2 tracking-wider">
                                Responsable del Movimiento
                            </label>

                            <div className="group relative flex items-center bg-slate-50 border border-blue-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-sm">
                                <div className="relative border-r border-blue-100 bg-white">
                                    <select
                                        value={formData.nombre.startsWith("CAPITAN. ") ? "CAPITAN. " : ""}
                                        disabled={soloLectura}
                                        onChange={(e) => {
                                            const nuevoPrefijo = e.target.value;
                                            const nombreLimpio = formData.nombre.replace(/^CAPITAN\.\s/, "");
                                            handleFieldChange("nombre", `${nuevoPrefijo}${nombreLimpio}`);
                                        }}
                                        className="appearance-none pl-4 pr-8 py-3 bg-transparent font-bold text-xs text-blue-600 cursor-pointer outline-none uppercase"
                                    >
                                        <option value="">Personal</option>
                                        <option value="CAPITAN. ">Capitán</option>
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={formData.nombre.replace(/^CAPITAN\.\s/, "")}
                                    placeholder="Escriba nombre y apellido..."
                                    className="flex-1 p-3 bg-transparent outline-none uppercase font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-normal placeholder:normal-case"
                                    required
                                    disabled={soloLectura}
                                    onChange={(e) => {
                                        const tienePrefijo = formData.nombre.startsWith("CAPITAN. ");
                                        const prefijo = tienePrefijo ? "CAPITAN. " : "";
                                        handleFieldChange("nombre", `${prefijo}${e.target.value.toUpperCase()}`);
                                    }}
                                />
                            </div>
                            <div className="flex justify-end mt-2">
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-600 text-[9px] font-bold border border-blue-200 uppercase">
                                    {formData.nombre || 'Sin nombre'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                    <textarea
                        value={formData.observaciones}
                        disabled={soloLectura}
                        placeholder="Notas adicionales..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none min-h-[80px]"
                        onChange={(e) => handleFieldChange("observaciones", e.target.value)}
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={alCerrar} className="flex-1 px-4 py-3 font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    {!soloLectura && (
                        <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                            {datosEdicion ? 'Guardar Cambios' : 'Confirmar Registro'}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};
