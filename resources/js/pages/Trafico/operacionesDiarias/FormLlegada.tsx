import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
    guardarOperacionesDiariasApi,
    verificarOperacionExistenteApi,
    obtenerNombresHistoricosApi
} from "@/stores/apiOperacionesDiarias";
import InputMatricula from "@/pages/InputMatricula";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";

export const FormLlegada = ({ alCerrar, nombreRol, moduloNombre, datosEdicion, soloLectura = false }: {
    alCerrar?: () => void,
    moduloNombre?: string,
    datosEdicion?: any,
    soloLectura?: boolean
    nombreRol?: string;
}) => {
    const { obtenerTipo } = useMatriculaAutocompleteStore();
    const [cargando, setCargando] = useState(false);
    const [sugerenciasNombres, setSugerenciasNombres] = useState<string[]>([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

    const getInitialState = (fecha?: string) => ({
        id: datosEdicion?.id || null,
        matricula: datosEdicion?.matricula || '',
        equipo: datosEdicion?.equipo || '',
        hora: datosEdicion?.hora?.substring(0, 5) || '',
        procedencia: datosEdicion?.lugar || '',
        pax: datosEdicion?.pax || null,
        equipaje: datosEdicion?.equipaje || null,
        tipo_cliente: datosEdicion?.tipo_cliente || '',
        tipo_operacion: datosEdicion?.tipo_operacion || '',
        departamento: moduloNombre,
        movimiento: 'Llegada',
        fecha: fecha || (datosEdicion?.fecha
            ? new Date(datosEdicion.fecha).toISOString().split('T')[0]
            : new Date().toLocaleDateString('sv-SE')),
        observaciones: datosEdicion?.observaciones || '',
        nombre: datosEdicion?.nombre || '',
        impulso: datosEdicion?.impulso || '',
        nombreRol: nombreRol
    });

    const [formData, setFormData] = useState(getInitialState());

    const handleFieldChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const buscarNombres = async (busqueda: string) => {
        if (busqueda.length < 2) {
            setSugerenciasNombres([]);
            return;
        }
        try {
            const nombres = await obtenerNombresHistoricosApi(busqueda);
            setSugerenciasNombres(nombres);
            setMostrarSugerencias(true);
        } catch (error) {
            console.error(error);
        }
    };

    const handleMatriculaSelect = async (matricula: string) => {
        const upperMat = matricula.toUpperCase();
        handleFieldChange("matricula", upperMat);
        buscarNombres(upperMat);

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
                        tipo_operacion: op.tipo_operacion || '',
                        departamento: moduloNombre,
                        movimiento: 'Llegada',
                        fecha: op?.fecha
                            ? new Date(op.fecha).toISOString().split('T')[0]
                            : new Date().toLocaleDateString('sv-SE'),
                        observaciones: op.observaciones || '',
                        nombre: op.nombre || '',
                        impulso: op.impulso || '',
                        nombreRol: nombreRol
                    });

                    if (op.nombre) buscarNombres(op.nombre);

                    Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 4000,
                        timerProgressBar: true,
                    }).fire({
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
                console.error(error);
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
                    text: `La matrícula "${formData.matricula}" no se encuentra en el sistema. ¿Está seguro que los datos y el equipo (${formData.equipo}) son correctos?`,
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
        <form onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-xl border-t-8 border-emerald-600 shadow-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {datosEdicion ? 'EDITAR LLEGADA' : 'NUEVA LLEGAGA'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Operaciones Diarias</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-4 shadow-sm group hover:border-emerald-300 transition-all">
                        <div className="bg-white shadow-sm rounded-xl p-2 text-emerald-600 flex flex-col items-center min-w-[45px] border border-slate-100">
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

                    <button type="button" onClick={alCerrar} className="group relative">
                        <div className="absolute -inset-1 bg-slate-100 rounded-full scale-0 group-hover:scale-100 transition-transform"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300 group-hover:text-red-500 relative transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {soloLectura && (
                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg flex items-center gap-2">
                    <span>REGISTRO VALIDADO POR {moduloNombre?.toUpperCase()} - SOLO LECTURA</span>
                </div>
            )}

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <InputMatricula
                            label="Matrícula"
                            value={formData.matricula}
                            onSelect={handleMatriculaSelect}
                            required
                            disabled={soloLectura}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipo</label>
                        <input
                            type="text"
                            value={formData.equipo}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            onChange={(e) => handleFieldChange("equipo", e.target.value.toUpperCase())}
                            required
                            disabled={soloLectura}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Llegada (24h)</label>
                        <input
                            type="text"
                            placeholder="HH:MM"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono disabled:bg-slate-100"
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
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100"
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
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100"
                            onChange={(e) => handleFieldChange("pax", parseInt(e.target.value) || 0)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipaje</label>
                        <input
                            type="text"
                            disabled={soloLectura || moduloNombre !== 'Trafico'}
                            value={formData.equipaje || ''}
                            placeholder={moduloNombre !== 'Trafico' ? "Solo Tráfico" : ""}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:opacity-70"
                            onChange={(e) => handleFieldChange("equipaje", e.target.value.toUpperCase())}
                            required={moduloNombre === 'Trafico'}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Cliente</label>
                        <select
                            value={formData.tipo_cliente}
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none disabled:bg-slate-100"
                            onChange={(e) => handleFieldChange("tipo_cliente", e.target.value)}
                            required={moduloNombre === 'Trafico'}
                            disabled={soloLectura || moduloNombre !== 'Trafico'}
                        >
                            <option value="">Seleccione una opción...</option>
                            <option value="TRÁNSITO">TRÁNSITO</option>
                            <option value="GUARDA">GUARDA</option>
                            <option value="AEROTAXI">AEROTAXI</option>
                            <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                            <option value="HANDLING">HANDLING</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                            Tipo operación
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                            {['NACIONAL', 'INTERNACIONAL'].map((opcion) => (
                                <button
                                    key={opcion}
                                    type="button"
                                    disabled={soloLectura || moduloNombre !== 'Trafico'}
                                    onClick={() => handleFieldChange("tipo_operacion", opcion)}
                                    className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-200
                                        ${formData.tipo_operacion === opcion
                                            ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-500 hover:bg-slate-200/50'
                                        }
                                        ${(soloLectura || moduloNombre !== 'Trafico') ? 'cursor-not-allowed opacity-50' : ''}
                                    `}
                                >
                                    {opcion}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={`p-4 rounded-xl border space-y-4 transition-colors ${moduloNombre === 'Seguridad' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                    <div>
                        <label className={`block text-[10px] font-bold uppercase mb-2 ${moduloNombre === 'Seguridad' ? 'text-emerald-600' : 'text-slate-500'}`}>
                            Tipo de Movimiento (Seguridad)
                        </label>
                        <div className="flex gap-8">
                            {['Propio Impulso', 'Remolcado'].map((opt) => (
                                <label key={opt} className={`flex items-center cursor-pointer group ${(soloLectura || moduloNombre !== 'Seguridad') ? 'cursor-not-allowed' : ''}`}>
                                    <input
                                        type="radio"
                                        disabled={soloLectura || moduloNombre !== 'Seguridad'}
                                        name="impulso"
                                        value={opt}
                                        checked={formData.impulso === opt}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                                    />
                                    <span className="ml-2 text-sm font-semibold text-slate-700">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <label className={`block text-[10px] font-bold uppercase mb-2 tracking-wider ${moduloNombre === 'Seguridad' ? 'text-emerald-600' : 'text-slate-500'}`}>
                            Responsable del Movimiento
                        </label>
                        <div className={`group relative flex items-center border rounded-2xl overflow-hidden transition-all shadow-sm ${moduloNombre === 'Seguridad' ? 'bg-white border-emerald-200' : 'bg-slate-100 border-slate-200'}`}>
                            <button
                                type="button"
                                disabled={soloLectura || moduloNombre !== 'Seguridad'}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setMostrarSugerencias(!mostrarSugerencias);
                                }}
                                className="p-3 border-r border-emerald-100 bg-white hover:bg-emerald-50 text-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${mostrarSugerencias ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div className="relative border-r border-emerald-100 bg-white">
                                <select
                                    value={formData.nombre.startsWith("CAPITAN. ") ? "CAPITAN. " : ""}
                                    disabled={soloLectura || moduloNombre !== 'Seguridad'}
                                    onChange={(e) => {
                                        const nuevoPrefijo = e.target.value;
                                        const nombreLimpio = formData.nombre.replace(/^CAPITAN\.\s/, "");
                                        handleFieldChange("nombre", `${nuevoPrefijo}${nombreLimpio}`);
                                    }}
                                    className="appearance-none pl-4 pr-8 py-3 bg-transparent font-bold text-xs text-emerald-600 cursor-pointer outline-none uppercase disabled:text-slate-400"
                                >
                                    <option value="">Personal</option>
                                    <option value="CAPITAN. ">Capitán</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                value={formData.nombre.replace(/^CAPITAN\.\s/, "")}
                                placeholder={moduloNombre !== 'Seguridad' ? "Campo exclusivo Seguridad" : "Escriba nombre..."}
                                className="flex-1 p-3 bg-transparent outline-none uppercase font-semibold text-slate-700 disabled:text-slate-500"
                                required={moduloNombre === 'Seguridad'}
                                disabled={soloLectura || moduloNombre !== 'Seguridad'}
                                onFocus={() => {
                                    const valorLimpio = formData.nombre.replace(/^CAPITAN\.\s/, "");
                                    if (valorLimpio.length >= 2) setMostrarSugerencias(true);
                                }}
                                onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                                onChange={(e) => {
                                    const nuevoValor = e.target.value.toUpperCase();
                                    const tienePrefijo = formData.nombre.startsWith("CAPITAN. ");
                                    const prefijo = tienePrefijo ? "CAPITAN. " : "";
                                    handleFieldChange("nombre", `${prefijo}${nuevoValor}`);
                                }}
                            />
                        </div>

                        {mostrarSugerencias && moduloNombre === 'Seguridad' && sugerenciasNombres.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                                {sugerenciasNombres.map((nombreSug, index) => (
                                    <li
                                        key={index}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleFieldChange("nombre", nombreSug.toUpperCase());
                                            setMostrarSugerencias(false);
                                        }}
                                        className="px-4 py-3 hover:bg-emerald-600 hover:text-white cursor-pointer text-sm font-semibold text-slate-700 border-b border-slate-50 last:border-none transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            {nombreSug}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                    <textarea
                        value={formData.observaciones}
                        disabled={soloLectura}
                        placeholder="Notas adicionales..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none min-h-[80px] disabled:bg-slate-100"
                        onChange={(e) => handleFieldChange("observaciones", e.target.value)}
                    />
                </div>

                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2 border-t border-slate-100">
                    <button type="button" onClick={alCerrar} className="flex-1 px-4 py-3 font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        Cancelar
                    </button>
                    {!soloLectura && (
                        <button
                            type="submit"
                            disabled={cargando}
                            className={`flex-1 px-4 py-3 rounded-lg font-bold shadow-lg transition-all
                                ${cargando
                                    ? 'bg-emerald-400 cursor-not-allowed scale-95'
                                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
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
