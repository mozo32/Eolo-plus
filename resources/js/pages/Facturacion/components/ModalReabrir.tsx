import { ErrorApi } from '@/stores/apiFacturacionCatalogos';
import { LockOpen } from 'lucide-react';
import { useState } from 'react';
import {
    BOTON_PRIMARIO,
    BOTON_SECUNDARIO,
    campoConError,
    errorStyle,
    labelStyle,
} from './estilos';
import ModalBase from './ModalBase';

/** Lo mismo que exige el servidor (`ReabrirPrefacturaRequest`): de 10 a 500 caracteres, sin contar los espacios de los extremos. */
export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 500;

interface Props {
    folio: number | null;
    onCerrar: () => void;
    /** Reabre. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra el error junto al motivo o como mensaje general. */
    onGuardar: (motivo: string) => Promise<void>;
}

/** Lo que se le dice a quien no tiene el permiso: reabrir es un permiso aparte del de capturar, y el 403 crudo no lo explica. */
const MENSAJE_SIN_PERMISO =
    'No tienes permiso para reabrir prefacturas. Es un permiso aparte del de capturar (el subdepartamento «factReabrirPrefactura»): pídeselo a quien administra los accesos.';

/**
 * Reabrir una prefactura cerrada para corregirla. El motivo es obligatorio y se valida aquí, antes de enviar: que el 422 del servidor sea
 * la primera vez que el usuario se entera de que tenía que escribirlo sería mala cara. El servidor sigue siendo la autoridad.
 *
 * Lo que hay que decirle a quien reabre antes de que lo haga: el documento que salió queda guardado (como versión, y se puede reimprimir
 * con la marca de no vigente), el folio se conserva, y mientras esté reabierta no se imprime nada.
 */
export default function ModalReabrir({ folio, onCerrar, onGuardar }: Props) {
    const [motivo, setMotivo] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const cambiar = (texto: string) => {
        setMotivo(texto);
        if (error) setError(null);
    };

    const reabrir = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const limpio = motivo.trim();
        setMensajeGeneral(null);

        if (limpio.length < MOTIVO_MIN) {
            setError(
                limpio === ''
                    ? 'Escribe por qué se reabre: queda en la historia del documento.'
                    : `El motivo es demasiado corto: explica qué hay que corregir (mínimo ${MOTIVO_MIN} caracteres).`,
            );
            return;
        }

        if (limpio.length > MOTIVO_MAX) {
            setError(`El motivo no puede pasar de ${MOTIVO_MAX} caracteres.`);
            return;
        }

        setError(null);
        setGuardando(true);

        try {
            await onGuardar(limpio);
        } catch (falla) {
            if (falla instanceof ErrorApi && falla.status === 403) {
                setMensajeGeneral(MENSAJE_SIN_PERMISO);
            } else if (falla instanceof ErrorApi && falla.errors.motivo) {
                setError(falla.errors.motivo[0]);
            } else {
                setMensajeGeneral(
                    falla instanceof Error ? falla.message : 'Error inesperado',
                );
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalBase
            idTitulo="titulo-modal-reabrir"
            titulo="Reabrir para corregir"
            subtitulo={
                folio === null
                    ? 'La prefactura vuelve a ser editable'
                    : `Folio ${folio}: vuelve a ser editable`
            }
            tieneCambios={motivo.trim() !== ''}
            bloqueado={guardando}
            onCerrar={onCerrar}
            ancho="max-w-lg"
        >
            <form onSubmit={reabrir} noValidate className="space-y-5">
                <div className="space-y-3 border bg-slate-50 p-5">
                    <p className="text-[11px] font-semibold text-slate-500">
                        El documento actual{' '}
                        <strong>queda guardado como una versión</strong>: se
                        puede volver a imprimir, con la marca de que ya no está
                        vigente. La prefactura conserva su folio
                        {folio === null ? '' : ` ${folio}`}.
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        Mientras esté reabierta{' '}
                        <strong>no se puede imprimir ni cotizar</strong>: hay
                        que volver a cerrarla.
                    </p>
                    <div
                        role="note"
                        className="rounded border-2 border-orange-300 bg-orange-50 p-3 text-[11px] font-semibold text-orange-900"
                    >
                        <p className="font-black uppercase">
                            Reabrir no se puede deshacer
                        </p>
                        <p className="mt-1">
                            No existe «cancelar la reapertura»: lo único que se
                            puede hacer es volver a cerrarla, y al cerrarla de
                            nuevo, aunque no corrijas nada:
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                            <li>
                                el documento sale con la{' '}
                                <strong>fecha de hoy</strong>, no con la
                                original;
                            </li>
                            <li>
                                «Elaborado por» pasa a ser{' '}
                                <strong>quien lo cierre</strong>;
                            </li>
                            <li>
                                el papel sale marcado «Corregida — sustituye a
                                la versión del …», aunque nadie haya corregido
                                nada;
                            </li>
                            <li>
                                la versión actual queda guardada{' '}
                                <strong>para siempre</strong>;
                            </li>
                            <li>
                                si mientras tanto cambió la tasa de IVA, cambian
                                el IVA y el total.
                            </li>
                        </ul>
                        <p className="mt-1">
                            Reabre solo si hay algo que corregir. Si abriste la
                            fila equivocada, cancela aquí: todavía no se ha
                            hecho nada.
                        </p>
                    </div>

                    <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <label
                                htmlFor="reabrir-motivo"
                                className={`${labelStyle} mb-0`}
                            >
                                Motivo <span className="text-red-500">*</span>
                            </label>
                            <span
                                className={`text-[10px] font-bold ${motivo.length > MOTIVO_MAX ? 'text-red-600' : 'text-slate-400'}`}
                                aria-live="off"
                            >
                                {motivo.length} / {MOTIVO_MAX}
                            </span>
                        </div>
                        <textarea
                            id="reabrir-motivo"
                            rows={4}
                            autoFocus
                            maxLength={MOTIVO_MAX}
                            value={motivo}
                            onChange={(e) => cambiar(e.target.value)}
                            className={`${campoConError(!!error)} resize-y`}
                            aria-invalid={error ? true : undefined}
                            aria-describedby="reabrir-motivo-ayuda"
                        />
                        {error ? (
                            <p className={errorStyle}>{error}</p>
                        ) : (
                            <p
                                id="reabrir-motivo-ayuda"
                                className="mt-1 text-[10px] font-bold text-slate-400 italic"
                            >
                                Qué se va a corregir. Queda en la historia del
                                documento (mínimo {MOTIVO_MIN} caracteres).
                            </p>
                        )}
                    </div>
                </div>

                {mensajeGeneral && (
                    <p
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                    >
                        {mensajeGeneral}
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCerrar}
                        disabled={guardando}
                        className={BOTON_SECUNDARIO}
                    >
                        CANCELAR
                    </button>
                    <button
                        type="submit"
                        disabled={guardando}
                        className={BOTON_PRIMARIO}
                    >
                        <LockOpen size={14} />
                        {guardando ? 'REABRIENDO…' : 'REABRIR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
