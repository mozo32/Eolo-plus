import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { guardarOperacionesDiariasApi, verificarOperacionExistenteApi } from "@/stores/apiOperacionesDiarias";
import InputMatricula from "@/pages/InputMatricula";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";

export const FormLlegada = ({ alCerrar, moduloNombre, datosEdicion, soloLectura = false }: {
    alCerrar?: () => void,
    moduloNombre?: string,
    datosEdicion?: any,
    soloLectura?: boolean
}) => {
    const { obtenerTipo } = useMatriculaAutocompleteStore();
    const [cargando, setCargando] = useState(false);

    const getInitialState = (fecha?: string) => ({
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
        fecha: fecha || (datosEdicion?.fecha
            ? new Date(datosEdicion.fecha).toISOString().split('T')[0]
            : new Date().toLocaleDateString('sv-SE')),
        observaciones: datosEdicion?.observaciones || '',
        nombre: datosEdicion?.nombre || '',
        impulso: datosEdicion?.impulso || ''
    });

    const [formData, setFormData] = useState(getInitialState());

    const handleFieldChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMatriculaSelect = async (matricula: string) => {
        const upperMat = matricula.toUpperCase();
        handleFieldChange("matricula", upperMat);

        if (upperMat.length > 2) {
            try {
                const check = await verificarOperacionExistenteApi(
                    upperMat,
                    formData.fecha,
                    'Llegada',
                    moduloNombre || ''
                );

                if (check.existe) {
                    const op = check.operacion;
                    setFormData({
                        id: op.id,
                        matricula: op.matricula,
                        equipo: op.equipo,
                        hora: op.hora.substring(0, 5),
                        procedencia: op.lugar || '',
                        pax: op.pax,
                        equipaje: op.equipaje,
                        tipo_cliente: op.tipo_cliente || '',
                        departamento: moduloNombre,
                        movimiento: 'Llegada',
                        fecha: op?.fecha
                            ? new Date(op.fecha).toISOString().split('T')[0]
                            : new Date().toLocaleDateString('sv-SE'),
                        observaciones: op.observaciones || '',
                        nombre: op.nombre || '',
                        impulso: op.impulso || ''
                    });

                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 4000,
                        timerProgressBar: true,
                    });

                    Toast.fire({
                        icon: 'info',
                        title: `Ya se registro la matrícula ${upperMat}, valide la informacion`
                    });

                    return;
                }
                const response = await obtenerTipo(upperMat) as any;
                if (response && response.tipo) {
                    handleFieldChange("equipo", response.tipo);
                }

            } catch (error) {
                console.error("Error en la verificación:", error);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cargando) return;

        try {
            const infoMatricula = await obtenerTipo(formData.matricula) as any;
            if (!infoMatricula || !infoMatricula.tipo) {
                const result = await Swal.fire({
                    title: '¿Matrícula no registrada?',
                    text: `La matrícula "${formData.matricula}" no se encuentra en el sistema. ¿Está seguro que los datos y el equipo (${formData.equipo}) son correctos para crear un nuevo registro permanente?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#2563eb',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Sí, es correcto',
                    cancelButtonText: 'Revisar datos',
                    reverseButtons: true
                });
                if (!result.isConfirmed) return;
            }
            setCargando(true);
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
            if (error instanceof Error) mensaje = error.message;
            Swal.fire({ icon: 'error', title: 'Error', text: mensaje });
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (!datosEdicion) {
            setFormData(prev => ({
                ...getInitialState(prev.fecha),
                id: null,
                matricula: '',
                equipo: '',
                hora: '',
                procedencia: '',
                pax: null,
                equipaje: null,
                tipo_cliente: '',
                observaciones: '',
                nombre: '',
                impulso: ''
            }));
        }
    }, [formData.fecha]);

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border-t-8 border-blue-600 shadow-sm w-full mb-6">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {datosEdicion ? 'EDITAR ARRIBO' : 'NUEVO ARRIBO'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Operaciones Diarias</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-4 shadow-sm group hover:border-blue-300 transition-all">
                        <div className="bg-white shadow-sm rounded-xl p-2 text-blue-600 flex flex-col items-center min-w-[45px] border border-slate-100">
                            <span className="text-[10px] font-black leading-none uppercase">Día</span>
                            <span className="text-lg font-bold leading-none mt-1">{formData.fecha.split('-')[2]}</span>
                        </div>
                        <div className="ml-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Fecha de Operación</label>
                            <input
                                type="date"
                                value={formData.fecha}
                                onChange={(e) => handleFieldChange("fecha", e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer block"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {soloLectura && (
                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg flex items-center gap-2">
                    <span>REGISTRO VALIDADO POR {moduloNombre?.toUpperCase()} - SOLO LECTURA</span>
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
                            value={formData.pax ?? ''}
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
                                value={formData.equipaje || ''}
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
                        <button
                            type="submit"
                            disabled={cargando}
                            className={`flex-1 px-4 py-3 rounded-lg font-bold shadow-lg transition-all
                                ${cargando
                                    ? 'bg-blue-400 cursor-not-allowed scale-95'
                                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
                                }`}
                        >
                            {cargando ? (
                                <div className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Procesando...
                                </div>
                            ) : (
                                datosEdicion ? 'Guardar Cambios' : 'Confirmar Registro'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};
