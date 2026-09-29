import { ErrorApi, type DatosCatalogo } from '@/stores/apiFacturacionCatalogos';
import { Save, Search } from 'lucide-react';
import { useState } from 'react';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { TARIFA_MAX, montoATexto, parsearMonto, validarMonto } from './formato';
import ModalBase from './ModalBase';

export const NOMBRE_MAX = 60;

/** Lo mínimo que comparten las categorías de aeronave y los tipos de motor. */
export type RegistroCatalogo = { id: number; nombre: string; status: 'A' | 'N' };

/** Un importe del catálogo: cómo se llama en el formulario, en el envío y cómo se lee de la fila. */
export interface CampoCatalogo<T> {
    /** Nombre del campo en la API (tarifa_pernocta…). */
    clave: string;
    /** Etiqueta de columna y de campo. */
    etiqueta: string;
    /** Cómo se dice en un mensaje de error: "la tarifa de pernocta". */
    enMensaje: string;
    leer: (registro: T) => string;
    ayuda?: string;
}

interface Props<T extends RegistroCatalogo> {
    titulo: string;
    subtitulo: string;
    /** null: alta. */
    registro: T | null;
    campos: CampoCatalogo<T>[];
    onCerrar: () => void;
    /** Guarda. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (datos: DatosCatalogo) => Promise<void>;
    /** El nombre repetido puede ser de una fila dada de baja: lleva a buscarla. */
    onBuscarNombre: (nombre: string) => void;
}

/** Alta y edición de un registro con nombre y uno o más importes (categorías y motores). */
export default function ModalCatalogo<T extends RegistroCatalogo>({ titulo, subtitulo, registro, campos, onCerrar, onGuardar, onBuscarNombre }: Props<T>) {
    const inicial = (): Record<string, string> => Object.fromEntries(campos.map(c => [c.clave, registro ? montoATexto(c.leer(registro)) : '']));

    const [nombre, setNombre] = useState(registro?.nombre ?? '');
    const [importes, setImportes] = useState<Record<string, string>>(inicial);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    /** El servidor rechazó el nombre (repetido): puede ser una fila dada de baja que la lista activa no muestra. */
    const [nombreRechazado, setNombreRechazado] = useState(false);

    const tieneCambios = nombre !== (registro?.nombre ?? '') || campos.some(c => importes[c.clave] !== (registro ? montoATexto(c.leer(registro)) : ''));

    const limpiarError = (clave: string) => setErrores(previos => (previos[clave] ? { ...previos, [clave]: '' } : previos));

    const validar = (): Record<string, string> => {
        const nuevos: Record<string, string> = {};
        const nombreLimpio = nombre.trim();

        if (nombreLimpio === '') nuevos.nombre = 'El nombre es obligatorio.';
        else if (nombreLimpio.length > NOMBRE_MAX) nuevos.nombre = `El nombre no puede pasar de ${NOMBRE_MAX} caracteres.`;

        for (const campo of campos) {
            // Cero es válido (cortesía); vacío no.
            const error = validarMonto(importes[campo.clave], { nombre: campo.enMensaje, obligatorio: true, decimales: 2, minimo: 0, maximo: TARIFA_MAX });
            if (error) nuevos[campo.clave] = error;
        }

        return nuevos;
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos = validar();
        setErrores(nuevos);
        setMensajeGeneral(null);
        setNombreRechazado(false);
        if (Object.keys(nuevos).length > 0) return;

        const datos: DatosCatalogo = { nombre: nombre.trim() };
        for (const campo of campos) datos[campo.clave] = parsearMonto(importes[campo.clave]) ?? 0;

        setGuardando(true);

        try {
            await onGuardar(datos);
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                // Se muestra el mensaje del servidor tal cual, campo por campo.
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
                setNombreRechazado(error.status === 422 && 'nombre' in error.errors);
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalBase idTitulo="titulo-modal-catalogo" titulo={titulo} subtitulo={subtitulo} tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-xl">
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Datos</h4>

                    <div>
                        <label htmlFor="nombre-catalogo" className={labelStyle}>
                            Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="nombre-catalogo"
                            type="text"
                            autoFocus
                            autoComplete="off"
                            maxLength={NOMBRE_MAX}
                            value={nombre}
                            onChange={e => {
                                setNombre(e.target.value);
                                limpiarError('nombre');
                            }}
                            className={campoConError(!!errores.nombre)}
                            aria-invalid={errores.nombre ? true : undefined}
                        />
                        {errores.nombre && <p className={errorStyle}>{errores.nombre}</p>}
                        {errores.nombre && nombreRechazado && (
                            <button
                                type="button"
                                onClick={() => onBuscarNombre(nombre.trim())}
                                className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-indigo-600 hover:text-indigo-800"
                            >
                                <Search size={12} />
                                Buscar este nombre entre todos, incluidos los dados de baja
                            </button>
                        )}
                    </div>

                    {campos.map(campo => (
                        <CampoMonto
                            key={campo.clave}
                            id={`campo-${campo.clave}`}
                            etiqueta={campo.etiqueta}
                            valor={importes[campo.clave]}
                            onChange={valor => {
                                setImportes(previos => ({ ...previos, [campo.clave]: valor }));
                                limpiarError(campo.clave);
                            }}
                            error={errores[campo.clave]}
                            obligatorio
                            ayuda={campo.ayuda ?? 'Cero es una tarifa válida (cortesía); no lo dejes vacío.'}
                        />
                    ))}
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'GUARDANDO…' : 'GUARDAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
