import { ErrorApi, type NuevoPrecioCombustible, type PrecioCombustible } from '@/stores/apiFacturacionCatalogos';
import { Save, TriangleAlert, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import CampoMonto from './CampoMonto';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, sectionTitle } from './estilos';
import { COMBUSTIBLE_MAX, COMBUSTIBLE_MIN, esTextoVacio, formatearMonto, parsearMonto, precioEoloSugerido, validarMonto } from './formato';
import ModalBase from './ModalBase';

interface Props {
    vigente: PrecioCombustible | null;
    /** Fórmula del precio Eolo tal como la fija el servidor. */
    formula: { ajuste: number; margen: number };
    onCerrar: () => void;
    /** Registra el precio. Debe lanzar el ErrorApi si el servidor rechaza. */
    onGuardar: (datos: NuevoPrecioCombustible) => Promise<void>;
}

const OPCIONES = { decimales: 4, minimo: COMBUSTIBLE_MIN, maximo: COMBUSTIBLE_MAX } as const;

/**
 * Alta de un precio de combustible. El ASA es el costo y el Eolo lo que se cobra.
 * Al teclear el ASA se propone el Eolo con la fórmula del servidor; si el
 * usuario lo edita, se envía el suyo, y si no, se omite y el servidor calcula.
 */
export default function ModalPrecioCombustible({ vigente, formula, onCerrar, onGuardar }: Props) {
    const [asa, setAsa] = useState('');
    const [eoloManual, setEoloManual] = useState('');
    const [sobrescrito, setSobrescrito] = useState(false);
    const [errores, setErrores] = useState<{ asa?: string; eolo?: string }>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const asaNumero = parsearMonto(asa);
    const propuesta = asaNumero !== null && asaNumero >= COMBUSTIBLE_MIN ? precioEoloSugerido(asaNumero, formula) : null;
    const eoloMostrado = sobrescrito ? eoloManual : propuesta !== null ? String(propuesta) : '';

    const tieneCambios = !esTextoVacio(asa) || sobrescrito;

    const alCambiarEolo = (valor: string) => {
        // Vaciar el campo devuelve la propuesta: vacío es "sin sobrescritura", no cero.
        setSobrescrito(!esTextoVacio(valor));
        setEoloManual(valor);
        setErrores(previos => ({ ...previos, eolo: undefined }));
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos = {
            asa: validarMonto(asa, { nombre: 'el precio ASA', obligatorio: true, ...OPCIONES }) ?? undefined,
            eolo: sobrescrito ? (validarMonto(eoloManual, { nombre: 'el precio Eolo', obligatorio: true, ...OPCIONES }) ?? undefined) : undefined,
        };

        setErrores(nuevos);
        setMensajeGeneral(null);
        if (nuevos.asa || nuevos.eolo) return;

        const datos: NuevoPrecioCombustible = { precio_asa: parsearMonto(asa) ?? 0 };
        if (sobrescrito) datos.precio_eolo = parsearMonto(eoloManual) ?? 0;

        // Lo que se va a registrar: el Eolo capturado o, si no se tocó, el que se propuso (el servidor lo calcula con la misma fórmula).
        const eoloARegistrar = datos.precio_eolo ?? propuesta;
        const nuevo = `Se registrará ASA ${formatearMonto(datos.precio_asa, 4)} · Eolo ${formatearMonto(eoloARegistrar, 4)}${sobrescrito ? '' : ' (propuesto)'}.`;

        const confirmacion = await Swal.fire({
            title: 'Registrar el nuevo precio',
            text: vigente
                ? `${nuevo} Se cerrará hoy la vigencia del precio actual (ASA ${formatearMonto(vigente.precio_asa, 4)} · Eolo ${formatearMonto(vigente.precio_eolo, 4)}) y el nuevo empezará a aplicar hoy. Un precio registrado no se puede editar ni borrar.`
                : `${nuevo} Será el primer precio registrado y no se podrá editar ni borrar.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Revisar',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true,
        });

        if (!confirmacion.isConfirmed) return;

        setGuardando(true);

        try {
            await onGuardar(datos);
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                setErrores({ asa: error.errors.precio_asa?.[0], eolo: error.errors.precio_eolo?.[0] });
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <ModalBase idTitulo="titulo-modal-combustible" titulo="Registrar precio de combustible" subtitulo="El ASA es el costo; el Eolo es lo que se cobra" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-xl">
            <form onSubmit={guardar} noValidate className="space-y-5">
                {vigente && (
                    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">
                            Registrar un precio cierra hoy la vigencia del actual (ASA {formatearMonto(vigente.precio_asa, 4)} · Eolo {formatearMonto(vigente.precio_eolo, 4)}). El precio nuevo empieza a aplicar hoy y no
                            podrá editarse ni borrarse.
                        </p>
                    </div>
                )}

                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Precios por litro</h4>

                    <CampoMonto
                        id="precio-asa"
                        etiqueta="Precio ASA (costo)"
                        valor={asa}
                        onChange={valor => {
                            setAsa(valor);
                            setErrores(previos => ({ ...previos, asa: undefined }));
                        }}
                        error={errores.asa}
                        obligatorio
                        autoFocus
                        placeholder="0.0000"
                        ayuda="Debe ser mayor que cero. Hasta 4 decimales."
                    />

                    <CampoMonto
                        id="precio-eolo"
                        etiqueta="Precio Eolo (se cobra)"
                        valor={eoloMostrado}
                        onChange={alCambiarEolo}
                        error={errores.eolo}
                        obligatorio
                        placeholder="Se propone al capturar el ASA"
                        junto={
                            sobrescrito ? (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase text-indigo-600">Capturado a mano</span>
                            ) : propuesta !== null ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-600">Propuesto</span>
                            ) : null
                        }
                        pie={
                            sobrescrito && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSobrescrito(false);
                                        setEoloManual('');
                                        setErrores(previos => ({ ...previos, eolo: undefined }));
                                    }}
                                    className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-indigo-600 hover:text-indigo-800"
                                >
                                    <WandSparkles size={12} />
                                    Volver a la propuesta
                                </button>
                            )
                        }
                        ayuda={`Propuesta con la fórmula del sistema: (ASA + ${formula.ajuste}) × ${formula.margen}. Puedes sobrescribirla; si no la tocas, el servidor calcula el precio con esa misma fórmula al guardar.`}
                    />
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'REGISTRANDO…' : 'REGISTRAR PRECIO'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
