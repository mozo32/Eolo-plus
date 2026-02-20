import { useState } from "react";
import Swal from "sweetalert2";
import { guardarOperacionesDiariasApi } from "@/stores/apiOperacionesDiarias";
import InputMatricula from "@/pages/InputMatricula";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";

export const FormLlegada = ({ alCerrar, moduloNombre, datosEdicion }: {
    alCerrar?: () => void,
    moduloNombre?: string,
    datosEdicion?: any
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

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <InputMatricula
                        label="Matrícula"
                        value={formData.matricula}
                        onSelect={handleMatriculaSelect}
                        required
                    />
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipo</label>
                        <input
                            type="text"
                            value={formData.equipo}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            onChange={(e) => handleFieldChange("equipo", e.target.value.toUpperCase())}
                            required
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
                                        name="impulso"
                                        value="Propio Impulso"
                                        required
                                        checked={formData.impulso === 'Propio Impulso'}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-slate-700">Propio Impulso</span>
                                </label>
                                <label className="flex items-center cursor-pointer group">
                                    <input
                                        type="radio"
                                        name="impulso"
                                        value="Remolcado"
                                        required
                                        checked={formData.impulso === 'Remolcado'}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-slate-700">Remolcado</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Nombre del piloto o remolcador</label>
                            <input
                                type="text"
                                value={formData.nombre}
                                placeholder="ESCRIBA EL NOMBRE COMPLETO..."
                                className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase font-semibold"
                                onChange={(e) => handleFieldChange("nombre", e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                    <textarea
                        value={formData.observaciones}
                        placeholder="Notas adicionales..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none min-h-[80px]"
                        onChange={(e) => handleFieldChange("observaciones", e.target.value)}
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={alCerrar} className="flex-1 px-4 py-3 font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                        {datosEdicion ? 'Guardar Cambios' : 'Confirmar Registro'}
                    </button>
                </div>
            </div>
        </form>
    );
};
