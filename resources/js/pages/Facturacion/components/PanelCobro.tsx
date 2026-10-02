import { ErrorApi, apiFormasPago, apiPrefacturas, mensajeDeError, type FormaPago, type Prefactura } from '@/stores/apiFacturacionCatalogos';
import { CreditCard, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, TD, TH, campoConError, errorStyle, labelStyle, sectionTitle, toast } from './estilos';
import { esMontoPositivo, formatearMonto, validarMonto } from './formato';
import ModalPagoAmex from './ModalPagoAmex';

/** El máximo de un pago (`fact_prefactura_pagos.monto`, decimal 12,2): el mismo que valida el servidor. */
const MONTO_MAX = 9999999999.99;

/** Códigos que se pintan junto al monto: el mensaje es el del servidor, tal cual. */
const CODIGOS_DEL_MONTO = ['supera_lo_que_falta', 'monto_fuera_de_rango'];

/** Códigos que explican por qué esa forma de pago no se puede usar ahora: se muestran sobre el formulario, con el mensaje del servidor. */
const CODIGOS_DE_LA_FORMA = ['avcard_con_combustible', 'forma_de_pago_no_disponible', 'amex_por_su_endpoint', 'servicio_comision_no_disponible'];

interface Props {
    prefactura: Prefactura;
    /** Recarga la ficha. */
    onCambio: () => Promise<void>;
    /** Lo que el panel no sabe resolver (la prefactura se cerró, se descartó, los totales no se calculan, un 5xx). */
    onError: (e: unknown, titulo: string) => Promise<void>;
}

/**
 * El cobro de una prefactura: los pagos, lo pagado, lo que falta, y el sobrepago.
 *
 *  - Todas las cifras son las del servidor. Aquí no se suma ni se resta dinero.
 *  - El sobrepago se parte en dos y los dos pueden salir a la vez: `cambio` es lo que se devuelve
 *    (nunca pasa del efectivo cobrado) y `cobrado_de_mas` es el resto, que NO se devuelve y se corrige en el
 *    pago. Llamar cambio al cobrado de más le diría al operador que entregue efectivo que nadie le dio.
 *  - Amex no está en el selector: tiene su propio botón porque agrega un renglón de comisión.
 *  - Una cerrada (o un borrador descartado) solo se lee: sin formulario y sin botones.
 */
export default function PanelCobro({ prefactura, onCambio, onError }: Props) {
    const soloLectura = prefactura.estado === 'cerrada' || prefactura.status === 'N';

    const [formas, setFormas] = useState<FormaPago[]>([]);
    const [cargandoFormas, setCargandoFormas] = useState(!soloLectura);
    const [errorFormas, setErrorFormas] = useState<string | null>(null);
    // Cambia cuando hay que volver a pedir el catálogo (una forma que se dio de baja entre la carga y el envío).
    const [versionFormas, setVersionFormas] = useState(0);

    const [formaId, setFormaId] = useState('');
    const [monto, setMonto] = useState('');
    const [errorForma, setErrorForma] = useState<string | null>(null);
    const [errorMonto, setErrorMonto] = useState<string | null>(null);
    const [avisoForma, setAvisoForma] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [quitando, setQuitando] = useState<number | null>(null);
    const [modalAmex, setModalAmex] = useState(false);

    useEffect(() => {
        if (soloLectura) return;

        let vigente = true;

        apiFormasPago
            .listar()
            .then(lista => {
                if (!vigente) return;
                setFormas(lista);
                setErrorFormas(null);
            })
            .catch(e => {
                if (vigente) setErrorFormas(mensajeDeError(e));
            })
            .finally(() => {
                if (vigente) setCargandoFormas(false);
            });

        return () => {
            vigente = false;
        };
    }, [soloLectura, versionFormas]);

    // Amex no va aquí: tiene su propio botón.
    const opciones = useMemo(() => formas.filter(f => f.status === 'A' && f.concepto !== 'amex').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [formas]);
    const hayAmex = formas.some(f => f.status === 'A' && f.concepto === 'amex');

    // Sin cifras no se ofrece cobrar con tarjeta ni con Amex: el servidor rechazaría el tope. Lo pagado sí se ve y el efectivo no depende de ellas.
    const sinCifras = prefactura.por_cobrar === null;
    const ocupado = enviando || quitando !== null;

    const pagos = prefactura.pagos ?? [];
    const hayCambio = esMontoPositivo(prefactura.cambio);
    const hayCobradoDeMas = esMontoPositivo(prefactura.cobrado_de_mas);

    const cambiarForma = (valor: string) => {
        setFormaId(valor);
        setErrorForma(null);
        setAvisoForma(null);
    };

    const cambiarMonto = (valor: string) => {
        setMonto(valor);
        setErrorMonto(null);
        setAvisoForma(null);
    };

    const registrar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (ocupado) return;

        const sinForma = formaId === '' ? 'Elige la forma de pago.' : null;
        const montoInvalido = validarMonto(monto, { nombre: 'el monto', obligatorio: true, decimales: 2, minimo: 0.01, maximo: MONTO_MAX });

        setErrorForma(sinForma);
        setErrorMonto(montoInvalido);
        setAvisoForma(null);
        if (sinForma !== null || montoInvalido !== null) return;

        setEnviando(true);

        try {
            await apiPrefacturas.agregarPago(prefactura.id, { forma_pago_id: Number(formaId), monto: monto.trim() });
            setMonto('');
            toast.fire({ icon: 'success', titleText: 'Pago registrado.' });
            await onCambio();
        } catch (error) {
            if (error instanceof ErrorApi && error.status < 500) {
                const delCampo = error.errors.monto?.[0] ?? (error.codigo !== null && CODIGOS_DEL_MONTO.includes(error.codigo) ? error.message : null);
                const deLaForma = error.errors.forma_pago_id?.[0] ?? (error.codigo !== null && CODIGOS_DE_LA_FORMA.includes(error.codigo) ? error.message : null);

                if (delCampo || deLaForma) {
                    if (delCampo) setErrorMonto(delCampo);
                    if (deLaForma) setAvisoForma(deLaForma);
                    // «Lo que falta» pudo cambiar, o una forma darse de baja: lo que se ve tiene que ser lo vigente.
                    if (error.codigo === 'forma_de_pago_no_disponible' || error.errors.forma_pago_id) {
                        setFormaId('');
                        setVersionFormas(v => v + 1);
                    }
                    await onCambio();
                    return;
                }
            }

            await onError(error, 'No se pudo registrar el pago');
        } finally {
            setEnviando(false);
        }
    };

    const quitar = async (pagoId: number, formaPago: string | null, importe: string, conComision: boolean) => {
        if (ocupado) return;
        setQuitando(pagoId);

        try {
            const confirmacion = await Swal.fire({
                // La forma de pago sale de un catálogo editable: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
                titleText: `Quitar el pago de ${formatearMonto(importe)}${formaPago ? ` (${formaPago})` : ''}`,
                text: conComision ? 'Al quitar este pago también se quita su comisión Amex, que es un renglón de la prefactura: el total baja y lo que falta por cobrar se recalcula.' : 'Lo que falta por cobrar se recalcula.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: conComision ? 'Sí, quitar pago y comisión' : 'Sí, quitar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626',
                reverseButtons: true,
            });
            if (!confirmacion.isConfirmed) return;

            await apiPrefacturas.quitarPago(prefactura.id, pagoId);
            toast.fire({ icon: 'success', titleText: conComision ? 'Pago y comisión quitados.' : 'Pago quitado.' });
            await onCambio();
        } catch (error) {
            await onError(error, 'No se pudo quitar el pago');
        } finally {
            setQuitando(null);
        }
    };

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="seccion-cobro">
            <h3 id="seccion-cobro" className={sectionTitle}>
                Cobro
            </h3>

            {prefactura.cobro_error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[12px] font-bold text-amber-800">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>{prefactura.cobro_error}</span>
                </div>
            )}

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[480px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-white">
                            <th className="px-6 py-3 text-left text-[9px] font-black uppercase text-slate-400">Forma de pago</th>
                            <th className={`${TH} text-right`}>Monto</th>
                            {!soloLectura && <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400">Acciones</th>}
                        </tr>
                    </thead>

                    <tbody>
                        {pagos.length === 0 && (
                            <tr>
                                <td colSpan={soloLectura ? 2 : 3} className="px-6 py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Sin pagos
                                </td>
                            </tr>
                        )}

                        {pagos.map(pago => (
                            <tr key={pago.id} className="border-b border-slate-50">
                                <td className="px-6 py-3">
                                    <p className="text-[11px] font-black uppercase text-slate-800">{pago.forma_pago ?? 'Forma de pago no disponible'}</p>
                                    {pago.es_comision_amex && <p className="text-[10px] font-bold text-slate-400">Incluye una comisión Amex agregada como renglón.</p>}
                                </td>
                                <td className={`${TD} text-right text-[11px] font-black text-slate-800`}>{formatearMonto(pago.monto)}</td>
                                {!soloLectura && (
                                    <td className="px-6 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {pago.es_comision_amex && <span className="text-right text-[10px] font-bold text-amber-700">Al quitarlo también se quita su comisión.</span>}
                                            <button
                                                type="button"
                                                onClick={() => void quitar(pago.id, pago.forma_pago, pago.monto, pago.es_comision_amex)}
                                                disabled={ocupado}
                                                title={pago.es_comision_amex ? 'Quitar el pago y su comisión' : 'Quitar el pago'}
                                                aria-label={pago.es_comision_amex ? `Quitar el pago de ${formatearMonto(pago.monto)} y su comisión` : `Quitar el pago de ${formatearMonto(pago.monto)}`}
                                                className="rounded p-2 text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <dl className="mt-4 grid max-w-md grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm">
                <dt className="text-[11px] font-bold uppercase text-slate-500">Pagado</dt>
                <dd className="text-right font-bold text-slate-700">{formatearMonto(prefactura.pagado)}</dd>

                <dt className="text-[11px] font-black uppercase text-slate-800">Falta por cobrar</dt>
                <dd className={`text-right font-black ${prefactura.por_cobrar === null ? 'text-red-600' : esMontoPositivo(prefactura.por_cobrar) ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {prefactura.por_cobrar === null ? 'No se pudo calcular' : formatearMonto(prefactura.por_cobrar)}
                </dd>

                {hayCambio && (
                    <>
                        <dt className="text-[11px] font-black uppercase text-sky-700">Cambio</dt>
                        <dd className="text-right font-black text-sky-700">{formatearMonto(prefactura.cambio)}</dd>
                    </>
                )}

                {hayCobradoDeMas && (
                    <>
                        <dt className="text-[11px] font-black uppercase text-amber-700">Cobrado de más</dt>
                        <dd className="text-right font-black text-amber-700">{formatearMonto(prefactura.cobrado_de_mas)}</dd>
                    </>
                )}
            </dl>

            {hayCambio && <p className="mt-2 text-[11px] font-bold text-sky-700">El cambio es dinero que se devuelve al cliente, de lo que pagó en efectivo.</p>}

            {hayCobradoDeMas && (
                <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] font-bold text-amber-800">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>Se cobró más que el total. Revisa el pago: el documento pudo editarse después de cobrarse.</span>
                </div>
            )}

            {!soloLectura && (
                <form onSubmit={registrar} noValidate className="mt-6 border-t border-slate-100 pt-5">
                    {avisoForma && (
                        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {avisoForma}
                        </p>
                    )}

                    {errorFormas && (
                        <p role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            <span>No se pudieron cargar las formas de pago. {errorFormas}</span>
                            <button type="button" onClick={() => setVersionFormas(v => v + 1)} className="text-[10px] font-black uppercase text-red-800 underline">
                                Reintentar
                            </button>
                        </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start">
                        <div>
                            <label htmlFor="cobro-forma" className={labelStyle}>
                                Forma de pago <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="cobro-forma"
                                value={formaId}
                                onChange={e => cambiarForma(e.target.value)}
                                disabled={cargandoFormas}
                                className={campoConError(!!errorForma)}
                                aria-invalid={errorForma ? true : undefined}
                            >
                                <option value="">{cargandoFormas ? 'Cargando…' : 'Elige una…'}</option>
                                {opciones.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.nombre}
                                    </option>
                                ))}
                            </select>
                            {errorForma && <p className={errorStyle}>{errorForma}</p>}
                        </div>

                        <CampoMonto id="cobro-monto" etiqueta="Monto" valor={monto} onChange={cambiarMonto} error={errorMonto ?? undefined} obligatorio />

                        <div className="flex flex-wrap items-center gap-2 md:mt-6">
                            <button type="submit" disabled={ocupado} className={`${BOTON_PRIMARIO} !px-4 !py-3`}>
                                <Plus size={14} />
                                {enviando ? 'REGISTRANDO…' : 'REGISTRAR PAGO'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalAmex(true)}
                                disabled={ocupado || sinCifras || !hayAmex}
                                title={sinCifras ? 'No se puede cobrar con Amex mientras los totales no se puedan calcular.' : !hayAmex ? 'No hay una forma de pago Amex activa.' : 'Agrega también un renglón de comisión'}
                                className={`${BOTON_SECUNDARIO} !py-3`}
                            >
                                <span className="flex items-center gap-2">
                                    <CreditCard size={14} />
                                    PAGO CON AMEX…
                                </span>
                            </button>
                        </div>
                    </div>

                    <p className="mt-2 text-[10px] font-bold italic text-slate-400">Amex va aparte porque agrega un renglón de comisión a la prefactura y el total cambia.</p>
                </form>
            )}

            {modalAmex && <ModalPagoAmex prefactura={prefactura} onCerrar={() => setModalAmex(false)} onCambio={onCambio} onError={onError} />}
        </section>
    );
}
