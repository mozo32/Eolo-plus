import { ErrorApi, apiPrefacturas, mensajeDeError, type Prefactura } from '@/stores/apiFacturacionCatalogos';
import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from './estilos';
import { comisionVistaPrevia, formatearMonto, formatearTasa, validarMonto } from './formato';
import ModalBase from './ModalBase';

/** El máximo de un pago (`fact_prefactura_pagos.monto`, decimal 12,2): el mismo que valida el servidor. */
const MONTO_MAX = 9999999999.99;

/** Códigos que se pintan junto al monto: el mensaje es el del servidor. */
const CODIGOS_DEL_MONTO = ['amex_supera_lo_que_falta', 'monto_fuera_de_rango'];

/** Códigos que explican por qué no se puede cobrar con Amex ahora: se muestran en el diálogo, con el mensaje del servidor. */
const CODIGOS_DEL_COBRO = ['servicio_comision_no_disponible', 'forma_de_pago_no_disponible', 'amex_por_su_endpoint'];

interface Props {
    prefactura: Prefactura;
    onCerrar: () => void;
    /** Recarga la ficha. Se llama al registrar y también cuando un rechazo deja la pantalla con cifras viejas. */
    onCambio: () => Promise<void>;
    /** Lo que el diálogo no sabe resolver (la prefactura se cerró, se descartó, los totales no se calculan, un 5xx). */
    onError: (e: unknown, titulo: string) => Promise<void>;
}

/** Lo que dejó el pago, con la comisión que devolvió el SERVIDOR y la estimación que se mostró antes. */
interface Registrado {
    monto: string;
    comision: string;
    estimada: number | null;
}

/**
 * Pago con Amex: aparte de las demás formas porque AGREGA un renglón de comisión a la
 * prefactura, y con él cambia el total.
 *
 *  - El monto es lo que se carga a la tarjeta (lo que el cliente verá en su estado de cuenta).
 *  - La comisión que se muestra mientras se teclea es una vista previa (`comisionVistaPrevia`, copia de
 *    `ComisionAmex::calcular()`); el servidor puede ajustarla unos centavos. Al terminar se muestra la suya.
 */
export default function ModalPagoAmex({ prefactura, onCerrar, onCambio, onError }: Props) {
    const [monto, setMonto] = useState('');
    const [errorMonto, setErrorMonto] = useState<string | null>(null);
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [registrado, setRegistrado] = useState<Registrado | null>(null);

    const estimada = comisionVistaPrevia(monto, prefactura.iva_tasa);
    const tieneCambios = registrado === null && monto !== '';

    const cambiarMonto = (texto: string) => {
        setMonto(texto);
        setErrorMonto(null);
        setMensajeGeneral(null);
    };

    const registrar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (enviando || registrado !== null) return;

        const invalido = validarMonto(monto, { nombre: 'el monto', obligatorio: true, decimales: 2, minimo: 0.01, maximo: MONTO_MAX });
        setErrorMonto(invalido);
        setMensajeGeneral(null);
        if (invalido !== null) return;

        setEnviando(true);

        try {
            const respuesta = await apiPrefacturas.agregarPagoAmex(prefactura.id, monto.trim());
            setRegistrado({ monto: monto.trim(), comision: respuesta.comision, estimada });
            await onCambio();
        } catch (error) {
            if (error instanceof ErrorApi && error.status < 500) {
                const delMonto = error.errors.monto?.[0] ?? (error.codigo !== null && CODIGOS_DEL_MONTO.includes(error.codigo) ? error.message : null);

                if (delMonto) {
                    setErrorMonto(delMonto);
                    // «Lo que falta» pudo cambiar desde que se abrió el diálogo: lo que se ve tiene que ser lo vigente.
                    await onCambio();
                    return;
                }

                if (error.codigo !== null && CODIGOS_DEL_COBRO.includes(error.codigo)) {
                    setMensajeGeneral(error.message);
                    await onCambio();
                    return;
                }

                if (error.codigo === null && Object.keys(error.errors).length === 0) {
                    setMensajeGeneral(mensajeDeError(error));
                    return;
                }
            }

            // Cerrada, descartada, totales sin calcular, un 5xx…: se resuelve en el editor, y el diálogo ya no tiene nada que hacer.
            onCerrar();
            await onError(error, 'No se pudo registrar el pago Amex');
        } finally {
            setEnviando(false);
        }
    };

    if (registrado !== null) {
        const difiere = registrado.estimada !== null && Number(registrado.comision) !== registrado.estimada;

        return (
            <ModalBase idTitulo="titulo-modal-amex" titulo="Pago Amex registrado" subtitulo="La comisión ya es un renglón de la prefactura" tieneCambios={false} onCerrar={onCerrar} ancho="max-w-lg">
                <div className="space-y-5">
                    <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-2 border bg-slate-50 p-5 text-sm">
                        <dt className="text-[11px] font-bold uppercase text-slate-500">Cargo a la tarjeta</dt>
                        <dd className="text-right font-black text-slate-800">{formatearMonto(registrado.monto)}</dd>
                        <dt className="text-[11px] font-bold uppercase text-slate-500">Comisión agregada (la del sistema)</dt>
                        <dd className="text-right font-black text-slate-800">{formatearMonto(registrado.comision)}</dd>
                    </dl>

                    {difiere && registrado.estimada !== null && (
                        <p className="text-[11px] font-semibold text-slate-500">
                            La vista previa decía {formatearMonto(registrado.estimada)}. El sistema ajusta la comisión unos centavos para que el total de la prefactura cuadre con el cargo a la tarjeta: la cifra válida es la de arriba.
                        </p>
                    )}

                    <div className="flex justify-end">
                        <button type="button" onClick={onCerrar} className={BOTON_PRIMARIO} autoFocus>
                            LISTO
                        </button>
                    </div>
                </div>
            </ModalBase>
        );
    }

    return (
        <ModalBase idTitulo="titulo-modal-amex" titulo="Pago con Amex" subtitulo="El monto es lo que se carga a la tarjeta" tieneCambios={tieneCambios} bloqueado={enviando} onCerrar={onCerrar} ancho="max-w-lg">
            <form onSubmit={registrar} noValidate className="space-y-5">
                <div className="space-y-3 border bg-slate-50 p-5">
                    <p className="text-[11px] font-semibold text-slate-500">
                        Teclea <strong>lo que se carga a la tarjeta</strong>, es decir, lo que el cliente verá en su estado de cuenta. La comisión Amex se agrega a la prefactura como un renglón nuevo, así que el total sube.
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        Falta por cobrar: <strong>{formatearMonto(prefactura.por_cobrar)}</strong>. El sistema no acepta un monto que, ya con su comisión, deje la prefactura pagada de más. Para saldarla de una sola vez con Amex el cargo es mayor que lo que falta, porque incluye la comisión.
                    </p>

                    <CampoMonto id="amex-monto" etiqueta="Monto que se carga a la tarjeta" valor={monto} onChange={cambiarMonto} error={errorMonto ?? undefined} obligatorio autoFocus />
                </div>

                {estimada !== null && (
                    <div className="space-y-1 border border-sky-200 bg-sky-50 p-4 text-[12px] font-bold text-sky-800" role="status">
                        <p>
                            Comisión estimada: {formatearMonto(estimada)} <span className="font-semibold">(IVA {formatearTasa(prefactura.iva_tasa)})</span>
                        </p>
                        <p className="text-[11px] font-semibold text-sky-700">
                            Es una vista previa, no la cifra oficial. Al registrar, el sistema calcula la comisión y puede ajustarla unos centavos para que el total cuadre con el cargo; verás la suya al terminar.
                        </p>
                    </div>
                )}

                {mensajeGeneral && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {mensajeGeneral}
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} disabled={enviando} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={enviando} className={BOTON_PRIMARIO}>
                        <CreditCard size={14} />
                        {enviando ? 'REGISTRANDO…' : 'REGISTRAR PAGO AMEX'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
