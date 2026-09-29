import {
    ErrorApi,
    type AeronaveFacturable,
    type CambiosAeronave,
    type CampoTarifaPropia,
    type CategoriaAeronave,
    type EstatusAeronave,
    type TipoMotor,
} from '@/stores/apiFacturacionCatalogos';
import { RotateCcw, Save, TriangleAlert, Undo2 } from 'lucide-react';
import { useState } from 'react';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { TARIFA_MAX, esTextoVacio, formatearMonto, montoATexto, parsearMonto, validarMonto } from './formato';
import ModalBase from './ModalBase';

export interface CatalogosAeronave {
    categorias: CategoriaAeronave[];
    motores: TipoMotor[];
    cargando: boolean;
    error: string | null;
}

interface Props {
    aeronave: AeronaveFacturable;
    catalogos: CatalogosAeronave;
    onCerrar: () => void;
    /** Guarda los cambios. Debe lanzar el ErrorApi si el servidor rechaza. */
    onGuardar: (cambios: CambiosAeronave) => Promise<void>;
}

interface DefinicionTarifa {
    clave: CampoTarifaPropia;
    etiqueta: string;
    enMensaje: string;
    /** De dónde hereda cuando la matrícula no tiene tarifa propia. */
    origen: 'categoria' | 'motor';
    leerOrigen: (categoria: CategoriaAeronave | null, motor: TipoMotor | null) => string | null;
}

const TARIFAS: DefinicionTarifa[] = [
    { clave: 'tarifa_pernocta', etiqueta: 'Pernocta', enMensaje: 'la tarifa de pernocta', origen: 'categoria', leerOrigen: c => c?.tarifa_pernocta ?? null },
    { clave: 'tarifa_transito_2h', etiqueta: 'Tránsito 2 h', enMensaje: 'la tarifa de tránsito de 2 horas', origen: 'categoria', leerOrigen: c => c?.tarifa_transito_2h ?? null },
    { clave: 'tarifa_transito_12h', etiqueta: 'Tránsito 12 h', enMensaje: 'la tarifa de tránsito de 12 horas', origen: 'categoria', leerOrigen: c => c?.tarifa_transito_12h ?? null },
    { clave: 'tarifa_aterrizaje', etiqueta: 'Aterrizaje', enMensaje: 'la tarifa de aterrizaje', origen: 'motor', leerOrigen: (_c, m) => m?.tarifa_aterrizaje ?? null },
];

/** El estatus de una matrícula. Tránsito paga estancia; guarda tiene contrato de hangar y no la paga. */
const ESTATUS: { valor: EstatusAeronave; titulo: string; descripcion: string }[] = [
    { valor: 'transito', titulo: 'Tránsito', descripcion: 'Paga estancia (pernocta y tránsitos). Es el estatus por omisión.' },
    { valor: 'guarda', titulo: 'Guarda', descripcion: 'Tiene contrato de hangar: no paga estancia.' },
];

const idATexto = (id: number | null): string => (id === null ? '' : String(id));

/**
 * Edición de los datos de cobro de una matrícula.
 *
 * Las tarifas propias tienen tres estados, y el modal los mantiene distintos:
 *   - sin tocar   → el campo no viaja y el servidor no lo toca;
 *   - se vacía    → viaja `null`: se borra la tarifa propia y la matrícula vuelve a heredar;
 *   - se captura  → viaja el número (cero incluido: es una cortesía).
 * "Vacío" y "cero" nunca se confunden: la comprobación es contra el texto, no contra el valor.
 */
export default function ModalAeronave({ aeronave, catalogos, onCerrar, onGuardar }: Props) {
    const [categoriaId, setCategoriaId] = useState(idATexto(aeronave.categoria_aeronave_id));
    const [motorId, setMotorId] = useState(idATexto(aeronave.tipo_motor_id));
    const [estatus, setEstatus] = useState<EstatusAeronave>(aeronave.estatus);
    const [cobraDerecho, setCobraDerecho] = useState(aeronave.cobra_derecho_vuelos);
    const [tarifas, setTarifas] = useState<Record<CampoTarifaPropia, string>>(() => ({
        tarifa_pernocta: montoATexto(aeronave.tarifa_pernocta),
        tarifa_transito_2h: montoATexto(aeronave.tarifa_transito_2h),
        tarifa_transito_12h: montoATexto(aeronave.tarifa_transito_12h),
        tarifa_aterrizaje: montoATexto(aeronave.tarifa_aterrizaje),
    }));
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    // La que ya tiene asignada siempre se ofrece, aunque esté de baja (el servidor lo permite para no perderla).
    const categorias = catalogos.categorias.filter(c => c.status === 'A' || c.id === aeronave.categoria_aeronave_id);
    const motores = catalogos.motores.filter(m => m.status === 'A' || m.id === aeronave.tipo_motor_id);

    const categoriaElegida =
        categoriaId === '' ? null : (catalogos.categorias.find(c => String(c.id) === categoriaId) ?? (String(aeronave.categoria?.id) === categoriaId ? aeronave.categoria : null));
    const motorElegido = motorId === '' ? null : (catalogos.motores.find(m => String(m.id) === motorId) ?? (String(aeronave.tipo_motor?.id) === motorId ? aeronave.tipo_motor : null));

    const textoInicial = (clave: CampoTarifaPropia): string => montoATexto(aeronave[clave]);
    const tarifaModificada = (clave: CampoTarifaPropia): boolean => tarifas[clave] !== textoInicial(clave);

    const tieneCambios =
        categoriaId !== idATexto(aeronave.categoria_aeronave_id) ||
        motorId !== idATexto(aeronave.tipo_motor_id) ||
        estatus !== aeronave.estatus ||
        cobraDerecho !== aeronave.cobra_derecho_vuelos ||
        TARIFAS.some(t => tarifaModificada(t.clave));

    const limpiarError = (clave: string) => setErrores(previos => (previos[clave] ? { ...previos, [clave]: '' } : previos));

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos: Record<string, string> = {};
        for (const t of TARIFAS) {
            // Vacío es válido (hereda); cero también (cortesía).
            const error = validarMonto(tarifas[t.clave], { nombre: t.enMensaje, obligatorio: false, decimales: 2, minimo: 0, maximo: TARIFA_MAX });
            if (error) nuevos[t.clave] = error;
        }

        setErrores(nuevos);
        setMensajeGeneral(null);
        if (Object.keys(nuevos).length > 0) return;

        // Solo viaja lo que cambió; el resto queda ausente y el servidor no lo toca.
        const cambios: CambiosAeronave = { estatus, cobra_derecho_vuelos: cobraDerecho };

        if (categoriaId !== idATexto(aeronave.categoria_aeronave_id)) cambios.categoria_aeronave_id = categoriaId === '' ? null : Number(categoriaId);
        if (motorId !== idATexto(aeronave.tipo_motor_id)) cambios.tipo_motor_id = motorId === '' ? null : Number(motorId);

        for (const t of TARIFAS) {
            if (!tarifaModificada(t.clave)) continue;
            cambios[t.clave] = esTextoVacio(tarifas[t.clave]) ? null : parsearMonto(tarifas[t.clave]);
        }

        setGuardando(true);

        try {
            await onGuardar(cambios);
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    const pieTarifa = (t: DefinicionTarifa) => {
        const texto = tarifas[t.clave];
        const vacia = esTextoVacio(texto);
        const modificada = tarifaModificada(t.clave);
        const origenElegido = t.origen === 'categoria' ? categoriaElegida : motorElegido;
        const heredada = t.leerOrigen(categoriaElegida, motorElegido);
        const nombreOrigen = t.origen === 'categoria' ? 'la categoría' : 'el tipo de motor';

        return (
            <div className="mt-2 space-y-1.5">
                {vacia ? (
                    heredada !== null && origenElegido ? (
                        <p className="text-xs font-bold text-slate-600">
                            Hereda de {nombreOrigen} «{origenElegido.nombre}»: <span className="text-slate-900">{formatearMonto(heredada)}</span>. Es lo que se cobrará.
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-red-600">
                            {t.origen === 'categoria' ? 'Sin categoría' : 'Sin tipo de motor'} y sin tarifa propia: no hay nada que cobrar.
                        </p>
                    )
                ) : (
                    <p className="text-xs font-bold text-slate-600">
                        Se cobrará <span className="text-slate-900">{formatearMonto(parsearMonto(texto))}</span>
                        {parsearMonto(texto) === 0 && ' (cortesía, sin cargo)'}
                        {heredada !== null && origenElegido && ` en lugar de ${formatearMonto(heredada)} de ${nombreOrigen} «${origenElegido.nombre}»`}.
                    </p>
                )}

                {modificada && (
                    <p className="text-[10px] font-black uppercase tracking-tighter text-amber-600">
                        {vacia ? 'Al guardar se quitará la tarifa propia y la matrícula volverá a heredar' : 'Al guardar se registrará esta tarifa propia'}
                    </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {!vacia && (
                        <button
                            type="button"
                            onClick={() => {
                                setTarifas(previas => ({ ...previas, [t.clave]: '' }));
                                limpiarError(t.clave);
                            }}
                            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-indigo-600 hover:text-indigo-800"
                        >
                            <RotateCcw size={12} />
                            Quitar tarifa propia (heredar)
                        </button>
                    )}
                    {modificada && (
                        <button
                            type="button"
                            onClick={() => {
                                setTarifas(previas => ({ ...previas, [t.clave]: textoInicial(t.clave) }));
                                limpiarError(t.clave);
                            }}
                            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-slate-500 hover:text-slate-700"
                        >
                            <Undo2 size={12} />
                            Deshacer
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const insigniaTarifa = (t: DefinicionTarifa) => {
        if (!esTextoVacio(tarifas[t.clave])) return <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase text-indigo-600">Propia</span>;

        return t.leerOrigen(categoriaElegida, motorElegido) !== null ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600">Hereda</span>
        ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase text-red-600">Sin tarifa</span>
        );
    };

    return (
        <ModalBase idTitulo="titulo-modal-aeronave" titulo={`Matrícula ${aeronave.matricula ?? ''}`} subtitulo="Datos de cobro de la matrícula" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-3xl">
            <form onSubmit={guardar} noValidate className="space-y-5">
                {catalogos.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">No se pudieron cargar las categorías y motores: {catalogos.error}</p>}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Clasificación</h4>

                        <div>
                            <label htmlFor="categoria-aeronave" className={labelStyle}>
                                Categoría
                            </label>
                            <select
                                id="categoria-aeronave"
                                value={categoriaId}
                                disabled={catalogos.cargando}
                                onChange={e => {
                                    setCategoriaId(e.target.value);
                                    limpiarError('categoria_aeronave_id');
                                }}
                                className={campoConError(!!errores.categoria_aeronave_id)}
                            >
                                <option value="">Sin categoría</option>
                                {categorias.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre}
                                        {c.status === 'N' ? ' (de baja)' : ''}
                                    </option>
                                ))}
                            </select>
                            {errores.categoria_aeronave_id && <p className={errorStyle}>{errores.categoria_aeronave_id}</p>}
                            {categoriaId === '' && (
                                <p className="mt-2 flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                                    <TriangleAlert size={14} className="mt-px shrink-0" />
                                    Sin categoría la matrícula no se puede facturar todavía.
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="tipo-motor" className={labelStyle}>
                                Tipo de motor
                            </label>
                            <select
                                id="tipo-motor"
                                value={motorId}
                                disabled={catalogos.cargando}
                                onChange={e => {
                                    setMotorId(e.target.value);
                                    limpiarError('tipo_motor_id');
                                }}
                                className={campoConError(!!errores.tipo_motor_id)}
                            >
                                <option value="">Sin tipo de motor</option>
                                {motores.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre}
                                        {m.status === 'N' ? ' (de baja)' : ''}
                                    </option>
                                ))}
                            </select>
                            {errores.tipo_motor_id && <p className={errorStyle}>{errores.tipo_motor_id}</p>}
                        </div>
                    </div>

                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Estatus y derechos</h4>

                        <fieldset>
                            <legend className={labelStyle}>Estatus</legend>
                            <div className="space-y-2">
                                {ESTATUS.map(op => (
                                    <label
                                        key={op.valor}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${estatus === op.valor ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="estatus-aeronave"
                                            value={op.valor}
                                            checked={estatus === op.valor}
                                            onChange={() => {
                                                setEstatus(op.valor);
                                                limpiarError('estatus');
                                            }}
                                            className="mt-1 accent-indigo-600"
                                        />
                                        <span>
                                            <span className="block text-xs font-black uppercase text-slate-700">{op.titulo}</span>
                                            <span className="block text-[11px] font-medium text-slate-500">{op.descripcion}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                            {errores.estatus && <p className={errorStyle}>{errores.estatus}</p>}
                        </fieldset>

                        <label className="flex cursor-pointer items-center gap-3">
                            <input type="checkbox" checked={cobraDerecho} onChange={e => setCobraDerecho(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                            <span className="text-xs font-extrabold uppercase text-slate-600">Cobra derecho de vuelos</span>
                        </label>
                        {errores.cobra_derecho_vuelos && <p className={errorStyle}>{errores.cobra_derecho_vuelos}</p>}
                    </div>
                </div>

                <div className="border bg-slate-50 p-5 space-y-4">
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#00677F]">Tarifas propias de la matrícula</h4>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                            Déjalas vacías para que la matrícula herede las de su categoría (aterrizaje: las de su tipo de motor). Escribe un importe solo si esta matrícula es una excepción. Cero es una tarifa válida (cortesía) y
                            no es lo mismo que vacío.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-6 md:grid-cols-2">
                        {TARIFAS.map(t => (
                            <CampoMonto
                                key={t.clave}
                                id={`tarifa-${t.clave}`}
                                etiqueta={t.etiqueta}
                                valor={tarifas[t.clave]}
                                onChange={valor => {
                                    setTarifas(previas => ({ ...previas, [t.clave]: valor }));
                                    limpiarError(t.clave);
                                }}
                                error={errores[t.clave]}
                                placeholder="Vacío: hereda"
                                junto={insigniaTarifa(t)}
                                pie={pieTarifa(t)}
                            />
                        ))}
                    </div>
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando || !tieneCambios} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'GUARDANDO…' : 'GUARDAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
