import { useState, useEffect } from "react";
import { useMatriculaAutocompleteStore } from "./useMatriculaAutocompleteStore";
import Swal from "sweetalert2";
import InputMatricula from "@/pages/InputMatricula";
import {
    guardarOperacionesDiariasApi,
    verificarOperacionExistenteApi,
    obtenerNombresHistoricosApi
} from "@/stores/apiOperacionesDiarias";

export const FormSalida = ({ alCerrar, nombreRol, moduloNombre, datosEdicion, soloLectura = false }: {
    alCerrar?: () => void;
    moduloNombre?: string;
    datosEdicion?: any;
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
        destino: datosEdicion?.lugar || '',
        pax: datosEdicion?.pax || null,
        tipo_cliente: datosEdicion?.tipo_cliente || '',
        tipo_operacion: datosEdicion?.tipo_operacion || '',
        departamento: moduloNombre,
        equipaje: datosEdicion?.equipaje || null,
        movimiento: 'Salida',
        fecha: fecha || (datosEdicion?.fecha
            ? new Date(datosEdicion.fecha).toISOString().split('T')[0]
            : new Date().toLocaleDateString('sv-SE')),
        observaciones: datosEdicion?.observaciones || '',
        nombre: datosEdicion?.nombre || '',
        impulso: datosEdicion?.impulso || '',
        nombreRol: nombreRol
    });

    const [formData, setFormData] = useState(getInitialState());

    const estaBloqueado = (moduloRequerido: string) => {
        return soloLectura || moduloNombre !== moduloRequerido;
    };

    const buscarNombres = async (busqueda: string) => {
        const terminoLimpio = busqueda.replace(/^CAPITAN\.\s/, "").trim();
        if (terminoLimpio.length < 2) {
            setSugerenciasNombres([]);
            return;
        }
        try {
            const nombres = await obtenerNombresHistoricosApi(terminoLimpio);
            setSugerenciasNombres(nombres);
            setMostrarSugerencias(true);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFieldChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
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
                    'Salida',
                    moduloNombre || ''
                );

                if (check.existe) {
                    const op = check.operacion;
                    setFormData({
                        id: op.id,
                        matricula: op.matricula,
                        equipo: op.equipo,
                        hora: op.hora?.substring(0, 5) || '',
                        destino: op.lugar || '',
                        pax: op.pax,
                        tipo_cliente: op.tipo_cliente || '',
                        tipo_operacion: op.tipo_operacion || '',
                        departamento: moduloNombre,
                        equipaje: op.equipaje,
                        movimiento: 'Salida',
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
                        icon: 'success',
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
            setCargando(true);
            await guardarOperacionesDiariasApi(formData);
            Swal.fire({
                icon: 'success',
                title: formData.id ? 'Actualizado' : 'Guardado',
                text: 'El plan de despegue se procesó con éxito',
                timer: 1500,
                showConfirmButton: false
            });
            if (alCerrar) alCerrar();
        } catch (error) {
            let mensaje = 'No se pudo registrar la salida';
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
                destino: '',
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
        <form onSubmit={handleSubmit} className="bg-white p-4 md:p-6 rounded-xl border-t-8 border-red-500 shadow-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {formData.id ? 'ACTUALIZAR SALIDA' : 'REGISTRO DE SALIDA'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Operaciones Diarias</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 pr-4 shadow-sm group hover:border-red-300 transition-all">
                        <div className="bg-white shadow-sm rounded-xl p-2 text-red-600 flex flex-col items-center min-w-[45px] border border-slate-100">
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
                            disabled={soloLectura}
                            value={formData.equipo}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            onChange={(e) => handleFieldChange("equipo", e.target.value.toUpperCase())}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora Salida (24h)</label>
                        <input
                            type="text"
                            disabled={soloLectura}
                            placeholder="HH:MM"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-mono"
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
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destino</label>
                        <input
                            type="text"
                            disabled={soloLectura}
                            value={formData.destino}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            onChange={(e) => handleFieldChange("destino", e.target.value.toUpperCase())}
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
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            onChange={(e) => handleFieldChange("pax", parseInt(e.target.value) || 0)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipaje</label>
                        <input
                            type="text"
                            disabled={estaBloqueado('Trafico')}
                            value={formData.equipaje || ''}
                            className={`w-full p-3 border rounded-lg outline-none transition-colors ${estaBloqueado('Trafico') ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-red-500'}`}
                            onChange={(e) => handleFieldChange("equipaje", e.target.value.toUpperCase())}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Cliente</label>
                        <select
                            disabled={estaBloqueado('Trafico')}
                            value={formData.tipo_cliente}
                            className={`w-full p-3 border rounded-lg outline-none appearance-none ${estaBloqueado('Trafico') ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-slate-200 focus:ring-2 focus:ring-red-500'}`}
                            onChange={(e) => handleFieldChange("tipo_cliente", e.target.value)}
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
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tipo operación</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                            {['NACIONAL', 'INTERNACIONAL'].map((opcion) => (
                                <button
                                    key={opcion}
                                    type="button"
                                    disabled={estaBloqueado('Trafico')}
                                    onClick={() => handleFieldChange("tipo_operacion", opcion)}
                                    className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-200
                                        ${formData.tipo_operacion === opcion
                                            ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-500 hover:bg-slate-200/50'
                                        } ${estaBloqueado('Trafico') ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    {opcion}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={`p-4 rounded-xl border transition-all ${estaBloqueado('Seguridad') ? 'bg-slate-50/50 border-slate-200 opacity-70' : 'bg-red-50/50 border-red-100'}`}>
                    <div className="mb-4">
                        <label className={`block text-[10px] font-bold uppercase mb-2 ${estaBloqueado('Seguridad') ? 'text-slate-400' : 'text-red-600'}`}>Tipo de Movimiento</label>
                        <div className="flex gap-8">
                            {['Propio Impulso', 'Remolcado'].map((op) => (
                                <label key={op} className={`flex items-center group ${estaBloqueado('Seguridad') ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                        type="radio"
                                        disabled={estaBloqueado('Seguridad')}
                                        name="impulso"
                                        value={op}
                                        checked={formData.impulso === op}
                                        onChange={(e) => handleFieldChange("impulso", e.target.value)}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                                    />
                                    <span className={`ml-2 text-sm font-semibold ${estaBloqueado('Seguridad') ? 'text-slate-400' : 'text-slate-700'}`}>{op}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <label className={`block text-[10px] font-bold uppercase mb-2 tracking-wider ${estaBloqueado('Seguridad') ? 'text-slate-400' : 'text-red-600'}`}>
                            Responsable del Movimiento
                        </label>
                        <div className={`group relative flex items-center border rounded-2xl overflow-hidden transition-all shadow-sm ${estaBloqueado('Seguridad') ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-red-200 focus-within:ring-2 focus-within:ring-red-500'}`}>
                            <button
                                type="button"
                                disabled={estaBloqueado('Seguridad')}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setMostrarSugerencias(!mostrarSugerencias);
                                }}
                                className="p-3 border-r border-red-100 bg-white hover:bg-red-50 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${mostrarSugerencias ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div className="relative border-r border-red-100 bg-white">
                                <select
                                    value={formData.nombre.startsWith("CAPITAN. ") ? "CAPITAN. " : ""}
                                    disabled={estaBloqueado('Seguridad')}
                                    onChange={(e) => {
                                        const nuevoPrefijo = e.target.value;
                                        const nombreLimpio = formData.nombre.replace(/^CAPITAN\.\s/, "");
                                        handleFieldChange("nombre", `${nuevoPrefijo}${nombreLimpio}`);
                                    }}
                                    className="appearance-none pl-4 pr-8 py-3 bg-transparent font-bold text-xs text-red-600 cursor-pointer outline-none uppercase disabled:text-slate-400"
                                >
                                    <option value="">Personal</option>
                                    <option value="CAPITAN. ">Capitán</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                value={formData.nombre.replace(/^CAPITAN\.\s/, "")}
                                placeholder="Escriba nombre y apellido..."
                                className="flex-1 p-3 bg-transparent outline-none uppercase font-semibold text-slate-700 disabled:placeholder-slate-300"
                                required={moduloNombre === 'Seguridad'}
                                disabled={estaBloqueado('Seguridad')}
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

                        {mostrarSugerencias && sugerenciasNombres.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white border border-slate-200 mt-1 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                                {sugerenciasNombres.map((nombreSug, index) => (
                                    <li
                                        key={index}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            const valorSug = nombreSug.toUpperCase();
                                            handleFieldChange("nombre", valorSug);
                                            setMostrarSugerencias(false);
                                        }}
                                        className="px-4 py-3 hover:bg-red-600 hover:text-white cursor-pointer text-sm font-semibold text-slate-700 border-b border-slate-50 last:border-none transition-colors"
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
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none min-h-[80px]"
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
                            className={`flex-1 px-4 py-3 rounded-lg font-bold shadow-lg transition-all ${cargando ? 'bg-red-400 cursor-not-allowed scale-95' : 'bg-red-600 hover:bg-red-700 text-white active:scale-95'}`}
                        >
                            {cargando ? 'Procesando...' : (formData.id ? 'Guardar Cambios' : 'Confirmar Registro')}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};
