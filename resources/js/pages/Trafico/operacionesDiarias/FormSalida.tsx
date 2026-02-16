import { useState } from "react";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";
import Swal from "sweetalert2";
import InputMatricula from "@/pages/InputMatricula";
import { guardarOperacionesDiariasApi } from "@/stores/apiOperacionesDiarias";

export const FormSalida = ({ alCerrar, moduloNombre, datosEdicion }: {
    alCerrar?: () => void;
    moduloNombre?: string;
    datosEdicion?: any;
}) => {
    const { obtenerTipo } = useMatriculaAutocompleteStore();

    const [formData, setFormData] = useState({
        id: datosEdicion?.id || null,
        matricula: datosEdicion?.matricula || '',
        equipo: datosEdicion?.equipo || '',
        hora: datosEdicion?.hora?.substring(0, 5) || '',
        destino: datosEdicion?.lugar || '',
        pax: datosEdicion?.pax || null,
        departamento: moduloNombre,
        equipaje: datosEdicion?.equipaje || null,
        movimiento: 'Salida',
        fecha: datosEdicion?.fecha || new Date().toISOString().split('T')[0],
        observaciones: datosEdicion?.observaciones || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await guardarOperacionesDiariasApi(formData);

            Swal.fire({
                icon: 'success',
                title: datosEdicion ? 'Actualizado' : 'Guardado',
                text: 'El plan de despegue se procesó con éxito',
                timer: 1500,
                showConfirmButton: false
            });

            if (alCerrar) alCerrar();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo registrar la salida'
            });
        }
    };
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
    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border-t-8 border-orange-500 shadow-2xl w-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold mb-1 uppercase tracking-tight text-slate-800">
                        {datosEdicion ? 'Actualizar Salida' : 'Registro de Salida'}
                    </h2>
                    <p className="text-sm text-slate-400">Complete el plan de despegue</p>
                </div>
                <button type="button" onClick={alCerrar} className="text-slate-300 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <InputMatricula
                            label="Matrícula"
                            value={formData.matricula}
                            onSelect={handleMatriculaSelect}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipo</label>
                        <input
                            type="text"
                            value={formData.equipo}
                            placeholder="G650"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            onChange={(e) => setFormData({ ...formData, equipo: e.target.value.toUpperCase() })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Salida</label>
                        <input
                            type="time"
                            value={formData.hora}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destino</label>
                        <input
                            type="text"
                            value={formData.destino}
                            placeholder="DFW"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            onChange={(e) => setFormData({ ...formData, destino: e.target.value.toUpperCase() })}
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
                            placeholder="0"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            onChange={(e) => setFormData({ ...formData, pax: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    {moduloNombre == 'Trafico' && (
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
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                    <textarea
                        value={formData.observaciones}
                        placeholder="Notas adicionales sobre el vuelo..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none min-h-[80px]"
                        onChange={(e) => handleFieldChange("observaciones", e.target.value)}
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={alCerrar}
                        className="flex-1 px-4 py-3 font-bold text-slate-500 bg-slate-100 rounded-lg transition-colors hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-3 font-bold text-white bg-orange-500 rounded-lg shadow-lg shadow-orange-200 transition-all hover:bg-orange-600 active:scale-95"
                    >
                        {datosEdicion ? 'Guardar Cambios' : 'Confirmar Despacho'}
                    </button>
                </div>
            </div>
        </form>
    );
};
