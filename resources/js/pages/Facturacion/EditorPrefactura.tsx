import { type AuthUser } from '@/components/navigation';
import AppLayout from '@/layouts/app-layout';
import { facturacionPrefacturas } from '@/routes';
import { ErrorApi, apiPrefacturas, mensajeDeError, urlCotizacionPrefactura, urlDocumentoPrefactura, urlVersionPrefactura, type DiscrepanciaSello, type Prefactura, type RenglonPrefactura, type VersionPrefactura } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Ban, FileText, Gift, Globe, Group, History, Lock, LockOpen, Plus, Printer, RefreshCw, Save, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Ungroup, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import CabeceraPantalla from './components/CabeceraPantalla';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, TD, TH, campoConError, errorStyle, labelStyle, sectionTitle, toast } from './components/estilos';
import { aCampoFechaHora, deCampoFechaHora, esConceptoComisionAmex, esConceptoDeEstancia, esMontoPositivo, fechaHoraSinZona, formatearMonto, formatearTasa } from './components/formato';
import ModalEstancia, { type CantidadesEstancia } from './components/ModalEstancia';
import ModalReabrir from './components/ModalReabrir';
import ModalRenglon, { type DatosRenglon } from './components/ModalRenglon';
import PanelCobro from './components/PanelCobro';
import PanelNotas from './components/PanelNotas';
import { puedeReabrirPrefactura } from './components/permisos';
import SelectorCliente from './components/SelectorCliente';

const TEXTO_MAX = 120;

/** Lo mismo que acepta el servidor para la etiqueta de un grupo. */
const GRUPO_MAX = 60;

/** Lo que devuelve el cierre del servidor. */
type RespuestaCierre = Awaited<ReturnType<typeof apiPrefacturas.cerrar>>;

/**
 * Los códigos de negocio que dicen que el estado que se ve ya no es el del servidor (o que el cierre se abortó): obligan a
 * recargar la ficha y se muestran con el mensaje del servidor. `sin_cobro` y `totales_no_calculables` son los del cobro;
 * el primero lo atiende el cierre (vuelve a pedir confirmación) y, si llega a otro sitio, se resuelve como los demás.
 * `no_reabrible` (409: ya no está cerrada, o su sello no cuadra) y `reabierta` (422: se pidió imprimir o cotizar una reabierta) son
 * los de la reapertura: la ficha que se ve está vieja.
 */
const CODIGOS_DE_ESTADO = ['incompleta', 'ya_cerrada', 'ya_descartada', 'sello_inconsistente', 'sin_cobro', 'totales_no_calculables', 'no_reabrible', 'reabierta'];

interface FormularioEncabezado {
    clienteId: number | null;
    clienteNombre: string | null;
    llegada: string;
    salida: string;
    origen: string;
    destino: string;
}

type CampoEncabezado = 'cliente_id' | 'llegada_at' | 'salida_at' | 'origen' | 'destino';

const CAMPOS_DEL_ENCABEZADO: CampoEncabezado[] = ['cliente_id', 'llegada_at', 'salida_at', 'origen', 'destino'];

const formularioDe = (p: Prefactura): FormularioEncabezado => ({
    clienteId: p.cliente_id,
    clienteNombre: p.cliente,
    llegada: aCampoFechaHora(p.llegada_at),
    salida: aCampoFechaHora(p.salida_at),
    origen: p.origen ?? '',
    destino: p.destino ?? '',
});

const sonIguales = (a: FormularioEncabezado, b: FormularioEncabezado): boolean =>
    a.clienteId === b.clienteId && a.llegada === b.llegada && a.salida === b.salida && a.origen === b.origen && a.destino === b.destino;

/**
 * El cuerpo del diálogo de agrupar: la explicación y, si la prefactura ya tiene grupos, un botón por etiqueta que la copia al campo.
 * La etiqueta ES la identidad del grupo, así que reutilizar una tiene que ser un clic y no haberla tecleado igual. Las etiquetas las
 * capturó un usuario: se pintan con `textContent`, nunca como HTML. Los estilos van en línea y no como clases de Tailwind porque el
 * cuerpo se arma con DOM fuera de JSX, y el escáner de Tailwind solo genera las clases que ve escritas en el fuente: así no dependemos de eso.
 */
function cuerpoDeAgrupar(existentes: string[]): HTMLElement {
    const cuerpo = document.createElement('div');
    cuerpo.style.fontSize = '14px';

    const explicacion = document.createElement('p');
    explicacion.textContent = 'Los renglones con la misma etiqueta salen juntos, en una sola fila, en el documento. El total no cambia.';
    cuerpo.append(explicacion);

    if (existentes.length > 0) {
        const aviso = document.createElement('p');
        aviso.textContent = 'Grupos que ya hay en esta prefactura (un clic para usar el mismo):';
        aviso.style.marginTop = '12px';
        cuerpo.append(aviso);

        const lista = document.createElement('div');
        lista.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:6px';

        for (const etiqueta of existentes) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.textContent = etiqueta;
            boton.style.cssText = 'border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca;border-radius:9999px;padding:2px 10px;font-weight:700;cursor:pointer';
            boton.addEventListener('click', () => {
                const campo = Swal.getInput();
                if (campo === null) return;
                campo.value = etiqueta;
                Swal.resetValidationMessage();
                campo.focus();
            });
            lista.append(boton);
        }

        cuerpo.append(lista);
    }

    return cuerpo;
}

const ETIQUETA_CAMPO_SELLO: Record<string, string> = { subtotal: 'Subtotal', iva: 'IVA', total: 'Total', iva_tasa: 'Tasa de IVA' };

/** Un valor del sello: dinero, o la tasa como porcentaje; "Sin sello" si la columna estaba vacía. */
function valorSello(campo: string, valor: string | null): string {
    if (valor === null) return 'Sin sello';

    return campo === 'iva_tasa' ? formatearTasa(valor) : formatearMonto(valor);
}

/**
 * Lo que dicen el sello y los totales del servidor. Una discrepancia entre el
 * total sellado y la derivación de los renglones se VE, no se calla: es el
 * defecto que tenían 830 prefacturas del sistema viejo —el 22% de sus 3,764
 * folios—, la peor por 561,749.93 pesos. Una verificación que no se pudo hacer
 * tampoco se esconde.
 */
function AvisosDelServidor({ prefactura }: { prefactura: Prefactura }) {
    // `[]` cuando no hay discrepancias, objeto cuando las hay: Object.entries tolera las dos formas.
    const discrepancias = Object.entries(prefactura.sello_discrepancias as Record<string, DiscrepanciaSello>);

    return (
        <>
            {prefactura.sello_discrepa === true && (
                <div role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-black uppercase text-red-700">
                        <ShieldAlert size={18} />
                        El total sellado no coincide con los renglones
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-red-700">
                        Esta prefactura se cerró con cifras que ya no corresponden a lo que suman sus renglones. No la uses como documento hasta aclarar la diferencia.
                    </p>

                    {discrepancias.length > 0 && (
                        <table className="mt-3 w-full max-w-xl border-collapse text-left text-[11px]">
                            <thead>
                                <tr className="border-b border-red-200 text-[9px] font-black uppercase text-red-500">
                                    <th className="py-1 pr-4">Concepto</th>
                                    <th className="py-1 pr-4">Sellado al cerrar</th>
                                    <th className="py-1">Lo que suman los renglones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {discrepancias.map(([campo, d]) => (
                                    <tr key={campo} className="border-b border-red-100 font-bold text-red-800">
                                        <td className="py-1 pr-4">{ETIQUETA_CAMPO_SELLO[campo] ?? campo}</td>
                                        <td className="py-1 pr-4">{valorSello(campo, d.sellado)}</td>
                                        <td className="py-1">{valorSello(campo, d.derivado)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {prefactura.sello_error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[12px] font-bold text-amber-800">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>
                        No se pudo verificar el sello de esta prefactura. {prefactura.sello_error}
                    </span>
                </div>
            )}

            {prefactura.totales_error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[12px] font-bold text-amber-800">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>{prefactura.totales_error}</span>
                </div>
            )}
        </>
    );
}

/**
 * El aviso que no se puede pasar por alto: una reabierta tiene folio y NO tiene documento. Si alguien la deja así, el folio queda como
 * hueco en la secuencia y el cliente se queda con un papel que el sistema ya no considera vigente. Es permanente: no se cierra.
 */
function AvisoDeReabierta({ prefactura }: { prefactura: Prefactura }) {
    return (
        <div role="alert" className="rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
            <p className="flex items-center gap-2 text-sm font-black uppercase text-orange-800">
                <LockOpen size={18} />
                Reabierta para corregir · conserva el folio {prefactura.folio ?? '—'}
            </p>
            <p className="mt-1 text-[12px] font-bold text-orange-800">
                No se puede imprimir —ni el documento ni la cotización— hasta volver a cerrarla. Corrige lo que haga falta y usa «Cerrar de nuevo»: si se queda así, el folio {prefactura.folio ?? ''} queda sin documento vigente.
            </p>
            <p className="mt-2 text-[11px] font-semibold text-orange-700">
                La cantidad de un renglón no se edita: para corregir un importe, quita el renglón y vuelve a agregarlo con la cantidad correcta.
            </p>
        </div>
    );
}

/**
 * Las versiones sustituidas: lo que el cliente pudo tener en la mano antes de la corrección. Cada una dice «no vigente», igual que su
 * papel, para que nadie confunda una reimpresión con el documento que vale. El PDF lo arma el servidor (se abre en otra pestaña).
 */
function VersionesDePrefactura({ prefacturaId, versiones }: { prefacturaId: number; versiones: VersionPrefactura[] }) {
    return (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="seccion-versiones">
            <div className="border-b border-slate-100 px-6 py-4">
                <h3 id="seccion-versiones" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <History size={14} />
                    {versiones.length} {versiones.length === 1 ? 'versión sustituida' : 'versiones sustituidas'}
                </h3>
                <p className="mt-1 text-[11px] font-bold italic text-slate-400">Son los documentos que salieron antes de corregir esta prefactura. Ninguno está vigente: el vigente es el actual.</p>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-white">
                            <th className="px-6 py-3 text-left text-[9px] font-black uppercase text-slate-400">Versión</th>
                            <th className="px-6 py-3 text-left text-[9px] font-black uppercase text-slate-400">Se cerró</th>
                            <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400">Total</th>
                            <th className="px-6 py-3 text-left text-[9px] font-black uppercase text-slate-400">Motivo de la corrección</th>
                            <th className="px-6 py-3 text-right text-[9px] font-black uppercase text-slate-400">Papel</th>
                        </tr>
                    </thead>
                    <tbody>
                        {versiones.map(v => (
                            <tr key={v.version} className="border-b border-slate-50">
                                <td className="px-6 py-3 text-[11px] font-black text-slate-800">
                                    Versión {v.version}
                                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600">No vigente</span>
                                </td>
                                <td className="px-6 py-3 text-[11px] font-bold text-slate-600">
                                    {fechaHoraSinZona(v.cerrada_at)}
                                    {v.reabierta_at !== null && <span className="block text-[10px] font-bold text-slate-400">sustituida el {fechaHoraSinZona(v.reabierta_at)}</span>}
                                </td>
                                <td className="px-6 py-3 text-right text-[11px] font-black text-slate-800">{formatearMonto(v.total_sellado)}</td>
                                <td className="px-6 py-3 text-[11px] font-semibold text-slate-600">{v.motivo}</td>
                                <td className="px-6 py-3 text-right">
                                    <a
                                        href={urlVersionPrefactura(prefacturaId, v.version)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Abrir el PDF de la versión ${v.version} (no vigente)`}
                                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800"
                                    >
                                        <FileText size={12} />
                                        PDF · no vigente
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

interface Props {
    id: number;
}

/**
 * Editor de una prefactura: un documento, no un catálogo. Encabezado, renglones,
 * totales, cobro y notas (estos dos últimos son componentes propios).
 *
 *  - Los totales y el importe de cada renglón son SIEMPRE los del servidor; esta
 *    pantalla no suma nada. Las únicas cuentas locales son dos vistas previas,
 *    rotuladas como tales y con su autoridad en PHP: el importe del renglón
 *    (`ModalRenglon`) y la comisión Amex (`ModalPagoAmex`).
 *  - Una prefactura cerrada es un documento emitido: ni siquiera se ofrece
 *    editarla (el endpoint también lo hace cumplir). Para corregirla se REABRE
 *    (`ModalReabrir`): queda editable, conserva el folio y no se imprime ni se
 *    cotiza hasta volver a cerrarla; el documento anterior queda como versión.
 *  - Los códigos de error de negocio (incompleta, ya_cerrada, ya_descartada,
 *    sello_inconsistente, sin_cobro, totales_no_calculables) piden cada uno una
 *    reacción distinta: ver `manejarError`.
 */
export default function EditorPrefactura({ id }: Props) {
    // Reabrir es un permiso aparte: quien no lo tiene no ve el botón (el servidor sigue siendo la autoridad y responde 403 si los permisos cambiaron).
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const puedeReabrir = puedeReabrirPrefactura(auth.user);

    const [prefactura, setPrefactura] = useState<Prefactura | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    // Una recarga que falla cuando ya hay una ficha en pantalla: lo que se ve puede estar viejo y hay que decirlo.
    const [recargaFallida, setRecargaFallida] = useState(false);

    const [form, setForm] = useState<FormularioEncabezado | null>(null);
    const [erroresForm, setErroresForm] = useState<Partial<Record<CampoEncabezado, string>>>({});
    const [guardandoEncabezado, setGuardandoEncabezado] = useState(false);

    const [modal, setModal] = useState<'renglon' | 'estancia' | 'reabrir' | null>(null);
    const [accionando, setAccionando] = useState<string | null>(null);
    const [avisoCargos, setAvisoCargos] = useState<string | null>(null);

    const peticionRef = useRef(0);
    const prefacturaRef = useRef<Prefactura | null>(null);
    // Las notas con cambios sin guardar. Su estado vive en `PanelNotas`; el editor solo necesita saberlo al cerrar.
    const notasPendientesRef = useRef<string[]>([]);
    const alCambiarNotasPendientes = useCallback((notas: string[]) => {
        notasPendientesRef.current = notas;
    }, []);

    /** Pone la ficha del servidor. El encabezado a medio capturar no se pisa con una recarga que no lo toca. */
    const aplicar = useCallback((nueva: Prefactura) => {
        const previa = prefacturaRef.current;
        prefacturaRef.current = nueva;
        setPrefactura(nueva);
        setForm(actual => (actual === null || previa === null || sonIguales(actual, formularioDe(previa)) ? formularioDe(nueva) : actual));
    }, []);

    const cargar = useCallback(async () => {
        const numero = ++peticionRef.current;

        try {
            const { prefactura: ficha } = await apiPrefacturas.ficha(id);
            // Una respuesta vieja no pisa la más reciente.
            if (numero !== peticionRef.current) return;
            aplicar(ficha);
            setErrorCarga(null);
            setRecargaFallida(false);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setErrorCarga(mensajeDeError(e));
            // `errorCarga` solo se pinta cuando no hay ficha. Con una ficha ya cargada, la pantalla seguiría mostrando lo de antes como si fuera lo vigente.
            if (prefacturaRef.current !== null) {
                setRecargaFallida(true);
                toast.fire({ icon: 'error', titleText: 'No se pudo actualizar la prefactura.' });
            }
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [id, aplicar]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Prefacturas', href: facturacionPrefacturas().url }, { title: prefactura ? (prefactura.folio === null ? `Borrador ${prefactura.matricula ?? ''}`.trim() : `Folio ${prefactura.folio}`) : 'Prefactura' }];

    const volverALista = () => router.visit(facturacionPrefacturas().url);

    /**
     * Cada código de negocio pide algo distinto:
     *  - incompleta (422): falta cliente o renglones; se dice, no se recarga (nada cambió).
     *  - ya_cerrada (409): alguien la cerró o ya estaba: lo que se ve está viejo, se recarga.
     *  - ya_descartada (409): el borrador ya no existe para trabajar: se recarga y se vuelve a la lista.
     *  - sello_inconsistente (409): el cierre se abortó; nada se guardó y reintentar es seguro.
     *  - no_reabrible (409), reabierta (422): la ficha que se ve está vieja (ya no está cerrada, o se pidió imprimir una reabierta): se dice y se recarga.
     *  - sin_cobro, totales_no_calculables (422): se muestra el mensaje del servidor y se recarga. (El cierre atiende `sin_cobro`
     *    antes de llegar aquí: vuelve a pedir la confirmación con el faltante que trae.)
     *  - 5xx: un mensaje genérico en español, nunca el «Server Error» crudo; se recarga, porque no se sabe cómo quedó.
     *  - 404: el registro ya no está (otra sesión lo quitó); se dice y se recarga.
     */
    const manejarError = useCallback(
        async (e: unknown, titulo: string) => {
            if (e instanceof ErrorApi && e.codigo === 'incompleta') {
                await Swal.fire({ icon: 'warning', titleText: 'Falta información para cerrar', text: e.message, confirmButtonColor: '#4f46e5' });
                return;
            }

            if (e instanceof ErrorApi && e.codigo === 'ya_cerrada') {
                await Swal.fire({ icon: 'info', titleText: 'La prefactura ya está cerrada', text: e.message, confirmButtonColor: '#4f46e5' });
                await cargar();
                return;
            }

            if (e instanceof ErrorApi && e.codigo === 'ya_descartada') {
                await Swal.fire({ icon: 'info', titleText: 'El borrador fue descartado', text: e.message, confirmButtonColor: '#4f46e5' });
                router.visit(facturacionPrefacturas().url);
                return;
            }

            if (e instanceof ErrorApi && e.codigo === 'sello_inconsistente') {
                await Swal.fire({
                    icon: 'warning',
                    titleText: 'El cierre se canceló',
                    text: 'Los totales cambiaron mientras se cerraba la prefactura. Nada se guardó y el folio no se consumió: puedes volver a intentar el cierre con seguridad.',
                    confirmButtonColor: '#4f46e5',
                });
                await cargar();
                return;
            }

            if (e instanceof ErrorApi && e.codigo === 'no_reabrible') {
                await Swal.fire({ icon: 'info', titleText: 'La prefactura no se puede reabrir', text: e.message, confirmButtonColor: '#4f46e5' });
                await cargar();
                return;
            }

            if (e instanceof ErrorApi && e.codigo === 'reabierta') {
                await Swal.fire({ icon: 'info', titleText: 'La prefactura está reabierta', text: e.message, confirmButtonColor: '#4f46e5' });
                await cargar();
                return;
            }

            if (e instanceof ErrorApi && e.codigo !== null && CODIGOS_DE_ESTADO.includes(e.codigo)) {
                await Swal.fire({ icon: 'warning', titleText: titulo, text: e.message, confirmButtonColor: '#4f46e5' });
                await cargar();
                return;
            }

            await Swal.fire({ icon: 'error', titleText: titulo, text: mensajeDeError(e), confirmButtonColor: '#4f46e5' });

            if (e instanceof ErrorApi && (e.status >= 500 || e.status === 404)) await cargar();
        },
        [cargar],
    );

    /** Una acción de un botón: una a la vez, y los errores van por `manejarError`. */
    const ejecutar = async (clave: string, tituloError: string, accion: () => Promise<void>) => {
        if (accionando !== null) return;
        setAccionando(clave);

        try {
            await accion();
        } catch (e) {
            await manejarError(e, tituloError);
        } finally {
            setAccionando(null);
        }
    };

    if (cargando && prefactura === null) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Prefactura" />
                <div className="p-6 bg-[#f3f4f6] min-h-screen">
                    <p className="py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando…</p>
                </div>
            </AppLayout>
        );
    }

    if (prefactura === null || form === null) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Prefactura" />
                <div className="p-6 bg-[#f3f4f6] min-h-screen">
                    <div className="py-16 text-center">
                        <p className="text-sm font-medium text-red-600">{errorCarga ?? 'No se pudo cargar la prefactura.'}</p>
                        <div className="mt-3 flex justify-center gap-4">
                            <button type="button" onClick={() => void cargar()} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                                Reintentar
                            </button>
                            <button type="button" onClick={volverALista} className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-700">
                                Volver a la lista
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    const cerrada = prefactura.estado === 'cerrada';
    // Una reabierta se edita como un borrador (por eso NO entra en `soloLectura`), pero tiene folio y no se descarta, no se cotiza ni se imprime.
    const reabierta = prefactura.estado === 'reabierta';
    const versiones = prefactura.versiones ?? [];
    const descartada = prefactura.status === 'N';
    // Una cerrada es un documento emitido y un descartado ya no existe para trabajar: ninguno de los dos se ofrece editar.
    const soloLectura = cerrada || descartada;
    const renglones = prefactura.renglones ?? [];
    const encabezadoModificado = !sonIguales(form, formularioDe(prefactura));
    const ocupado = accionando !== null || guardandoEncabezado;

    const cambiar = <K extends keyof FormularioEncabezado>(clave: K, valor: FormularioEncabezado[K], campo: CampoEncabezado) => {
        setForm(previo => (previo === null ? previo : { ...previo, [clave]: valor }));
        setErroresForm(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
    };

    const guardarEncabezado = async () => {
        if (ocupado) return;

        const nuevos: Partial<Record<CampoEncabezado, string>> = {};
        if (form.llegada !== '' && form.salida !== '' && form.salida < form.llegada) nuevos.salida_at = 'La salida no puede ser anterior a la llegada.';
        if (form.origen.trim().length > TEXTO_MAX) nuevos.origen = `El origen no puede pasar de ${TEXTO_MAX} caracteres.`;
        if (form.destino.trim().length > TEXTO_MAX) nuevos.destino = `El destino no puede pasar de ${TEXTO_MAX} caracteres.`;

        setErroresForm(nuevos);
        if (Object.keys(nuevos).length > 0) return;

        setGuardandoEncabezado(true);

        try {
            // La matrícula y el tipo de destino no se editan aquí (el destino internacional lo marca su botón), pero el servidor los exige.
            const { prefactura: guardada } = await apiPrefacturas.editar(prefactura.id, {
                aeronave_id: prefactura.aeronave_id,
                tipo_destino: prefactura.tipo_destino,
                cliente_id: form.clienteId,
                llegada_at: deCampoFechaHora(form.llegada),
                salida_at: deCampoFechaHora(form.salida),
                origen: form.origen.trim() === '' ? null : form.origen.trim(),
                destino: form.destino.trim() === '' ? null : form.destino.trim(),
            });

            aplicar(guardada);
            setForm(formularioDe(guardada));
            toast.fire({ icon: 'success', titleText: 'Encabezado guardado.' });
        } catch (e) {
            const delCampo = e instanceof ErrorApi && e.codigo === null ? Object.entries(e.errors).filter(([campo]) => CAMPOS_DEL_ENCABEZADO.includes(campo as CampoEncabezado)) : [];

            if (delCampo.length > 0) {
                // Errores por campo del servidor, junto a cada campo.
                setErroresForm(Object.fromEntries(delCampo.map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                await manejarError(e, 'No se pudo guardar el encabezado');
            }
        } finally {
            setGuardandoEncabezado(false);
        }
    };

    /** Los códigos de estado se resuelven aquí (cerrando el modal); lo demás vuelve al modal para mostrarse junto a sus campos. */
    const resolverEnModal = async (e: unknown): Promise<void> => {
        if (e instanceof ErrorApi && e.codigo !== null && CODIGOS_DE_ESTADO.includes(e.codigo)) {
            setModal(null);
            await manejarError(e, 'No se pudo completar la acción');
            return;
        }

        throw e;
    };

    const agregarRenglon = async (datos: DatosRenglon) => {
        try {
            await apiPrefacturas.agregarRenglon(prefactura.id, { ...datos });
        } catch (e) {
            await resolverEnModal(e);
            return;
        }

        setModal(null);
        toast.fire({ icon: 'success', titleText: 'Servicio agregado.' });
        await cargar();
    };

    const recalcularEstancia = async (cantidades: CantidadesEstancia) => {
        let resultado;

        try {
            resultado = await apiPrefacturas.estancia(prefactura.id, { ...cantidades });
        } catch (e) {
            await resolverEnModal(e);
            return;
        }

        setModal(null);
        // Se recarga siempre: aunque no se genere ningún renglón, el servidor pudo quitar los cargos previos.
        await cargar();
        setAvisoCargos(resultado.motivo);

        if (resultado.renglones === 0) {
            // El caso principal es una aeronave en Guarda, que no paga estancia: sin explicación, el operador no entiende qué pasó.
            await Swal.fire({
                icon: 'info',
                titleText: 'No se generó ningún cargo de estancia',
                text: resultado.motivo ?? 'Con las cantidades indicadas no corresponde ningún cargo.',
                confirmButtonColor: '#4f46e5',
            });
        } else {
            toast.fire({ icon: 'success', titleText: `Estancia recalculada: ${resultado.renglones} ${resultado.renglones === 1 ? 'cargo' : 'cargos'}.` });
        }
    };

    /**
     * La comisión Amex es la contrapartida de un cargo ya hecho a la tarjeta. No se bloquea (no cobrársela al cliente es una intención
     * plausible), pero quien opera tiene que saber que el documento quedará por debajo de lo que se cargó.
     */
    const confirmarSobreComisionAmex = async (nombre: string, accion: 'cortesia' | 'quitar'): Promise<boolean> => {
        const confirmacion = await Swal.fire({
            // El nombre sale del catálogo: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
            titleText: accion === 'cortesia' ? `Marcar "${nombre}" como cortesía` : `Quitar "${nombre}"`,
            text: `Este renglón es la comisión de un pago con Amex. ${accion === 'cortesia' ? 'Si no se cobra' : 'Si se quita'}, el documento quedará por debajo de lo que se cargó a la tarjeta.${accion === 'quitar' ? ' El pago dejará de tener comisión.' : ''} ¿Continuar?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: accion === 'cortesia' ? 'Sí, marcar como cortesía' : 'Sí, quitar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true,
        });

        return confirmacion.isConfirmed;
    };

    /**
     * Dentro de un grupo el importe de una cortesía cuenta como 0.00 y la fila del grupo no lleva la marca: el cliente deja de ver que ese
     * servicio fue gratis. El total no cambia. No se bloquea (agrupar una cortesía puede ser lo que se quiere), pero quien opera tiene que
     * saberlo. `situacion` dice cuál de los dos caminos llega aquí: agrupar una cortesía, o marcar como cortesía un renglón ya agrupado.
     */
    const confirmarCortesiaEnGrupo = async (nombre: string, situacion: 'agrupar' | 'marcar'): Promise<boolean> => {
        const confirmacion = await Swal.fire({
            // El nombre sale del catálogo: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
            titleText: situacion === 'agrupar' ? `Agrupar "${nombre}"` : `Marcar "${nombre}" como cortesía`,
            text: `${situacion === 'agrupar' ? 'Este renglón es una cortesía.' : 'Este renglón está dentro de un grupo.'} Dentro de un grupo su importe cuenta como 0.00 y la fila del grupo no lleva la marca de cortesía: en el documento el cliente dejará de ver que este servicio fue gratis. El total no cambia. ¿Continuar?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: situacion === 'agrupar' ? 'Sí, agrupar' : 'Sí, marcar como cortesía',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true,
        });

        return confirmacion.isConfirmed;
    };

    const quitarRenglon = (renglonId: number, nombre: string, concepto: string | null) =>
        ejecutar(`quitar-${renglonId}`, 'No se pudo quitar el servicio', async () => {
            const confirmado = esConceptoComisionAmex(concepto)
                ? await confirmarSobreComisionAmex(nombre, 'quitar')
                : (
                      await Swal.fire({
                          // El nombre sale del catálogo y lo capturó un usuario: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
                          titleText: `Quitar "${nombre}"`,
                          text: 'El renglón sale de la prefactura y los totales se recalculan.',
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonText: 'Sí, quitar',
                          cancelButtonText: 'Cancelar',
                          confirmButtonColor: '#dc2626',
                          reverseButtons: true,
                      })
                  ).isConfirmed;
            if (!confirmado) return;

            await apiPrefacturas.quitarRenglon(prefactura.id, renglonId);
            toast.fire({ icon: 'success', titleText: 'Servicio quitado.' });
            await cargar();
        });

    /**
     * Reabre la cerrada con el motivo del modal. La respuesta trae la ficha ya reabierta (con la versión que acaba de guardarse), así que
     * se aplica sin otra lectura. Los códigos de estado cierran el modal y se resuelven aparte; lo demás (el 403 sin permiso, el 422 del
     * motivo) vuelve al modal para mostrarse junto al campo.
     */
    const reabrirPrefactura = async (motivo: string) => {
        let respuesta;

        try {
            respuesta = await apiPrefacturas.reabrir(prefactura.id, motivo);
        } catch (e) {
            await resolverEnModal(e);
            return;
        }

        setModal(null);
        setAvisoCargos(null);
        aplicar(respuesta.prefactura);
        toast.fire({ icon: 'success', titleText: respuesta.message });
    };

    const marcarInternacional = () =>
        ejecutar('internacional', 'No se pudo marcar como internacional', async () => {
            const confirmacion = await Swal.fire({
                titleText: 'Marcar como internacional',
                text: 'Se agregan a la prefactura los servicios del paquete internacional. No hay forma de deshacerlo desde esta pantalla.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, marcar internacional',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                reverseButtons: true,
            });
            if (!confirmacion.isConfirmed) return;

            const { renglones: agregados, motivo } = await apiPrefacturas.internacional(prefactura.id);
            await cargar();

            if (motivo !== null) {
                // El servidor avisa cuando el paquete no se agregó completo (un servicio dado de baja, o ninguno marcado): un toast de
                // «agregado» sobre un paquete que cobra de menos sería peor que no avisar. Se queda como aviso en la tabla.
                setAvisoCargos(motivo);
                await Swal.fire({
                    icon: 'warning',
                    titleText: agregados === 0 ? 'No se agregó el paquete internacional' : 'El paquete internacional quedó incompleto',
                    text: motivo,
                    confirmButtonColor: '#4f46e5',
                });
                return;
            }

            // Sin motivo y sin agregados, el paquete ya estaba completo en los renglones: decir «agregado: 0 servicios» sonaria a que algo fallo.
            toast.fire({
                icon: 'success',
                titleText:
                    agregados === 0
                        ? 'Marcada internacional: el paquete ya estaba en los renglones.'
                        : `Paquete internacional agregado: ${agregados} ${agregados === 1 ? 'servicio' : 'servicios'}.`,
            });
        });

    const descartar = () =>
        ejecutar('descartar', 'No se pudo descartar el borrador', async () => {
            const confirmacion = await Swal.fire({
                titleText: `Descartar el borrador de ${prefactura.matricula ?? 'esta prefactura'}`,
                text: 'El borrador sale de la lista y ya no se podrá editar ni cerrar. Úsalo para quitar un borrador abierto por error; no se puede deshacer desde esta pantalla.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, descartar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626',
                reverseButtons: true,
            });
            if (!confirmacion.isConfirmed) return;

            await apiPrefacturas.descartar(prefactura.id);
            toast.fire({ icon: 'success', titleText: 'Borrador descartado.' });
            router.visit(facturacionPrefacturas().url);
        });

    /** Sin totales no hay nada que sellar: el servidor tampoco cierra. El botón se deshabilita y se dice por qué. */
    const sinTotales = prefactura.totales_error !== null || prefactura.cobro_error !== null || prefactura.por_cobrar === null;

    /**
     * Solo un sello verificado y bueno (`false`) deja imprimir. `true` es «verificado y no cuadra» (el servidor responde 409) y `null` es
     * «no se pudo verificar» (422): en los dos el botón se deshabilita, y `!sello_discrepa` dejaría pasar el `null`.
     */
    const motivoSinImprimir =
        prefactura.sello_discrepa === false
            ? null
            : prefactura.sello_discrepa === true
              ? 'El sello no coincide con los renglones: no se puede imprimir hasta aclarar la diferencia.'
              : 'No se pudo verificar el sello: no se puede imprimir hasta corregirlo.';

    const cortesia = (renglonId: number, nombre: string, marcar: boolean, concepto: string | null, grupo: string | null) =>
        ejecutar(`cortesia-${renglonId}`, 'No se pudo cambiar la cortesía', async () => {
            // Solo al MARCAR: quitar la cortesía vuelve a cobrar la comisión, que es lo que cuadra con la tarjeta.
            if (marcar && esConceptoComisionAmex(concepto) && !(await confirmarSobreComisionAmex(nombre, 'cortesia'))) return;
            // Marcar la cortesía de un renglón que ya va en un grupo lo esconde igual que agruparlo: se avisa en los dos caminos.
            if (marcar && grupo !== null && !(await confirmarCortesiaEnGrupo(nombre, 'marcar'))) return;

            await apiPrefacturas.cortesia(prefactura.id, renglonId, marcar);
            await cargar();
            toast.fire({ icon: 'success', titleText: marcar ? `«${nombre}» queda como cortesía: ya no se cobra.` : `«${nombre}» vuelve a cobrarse.` });
        });

    /**
     * Pide la etiqueta con la que sale el renglón y la manda; el servidor guarda lo que llega (recortado) y esa etiqueta es la identidad
     * del grupo. Una etiqueta en blanco la leería como «desagrupar» (`ConvertEmptyStringsToNull`), así que el diálogo no deja enviarla:
     * lo que hay aquí, no el servidor, es lo que impide que el operador crea que agrupó y haya desagrupado.
     */
    const agrupar = (renglon: RenglonPrefactura) =>
        ejecutar(`grupo-${renglon.id}`, 'No se pudo agrupar el servicio', async () => {
            // Con grupo ya puesto, la cortesía ya estaba escondida: el aviso es solo para el paso de suelto a agrupado.
            if (renglon.es_cortesia && renglon.grupo === null && !(await confirmarCortesiaEnGrupo(renglon.nombre_servicio, 'agrupar'))) return;

            const existentes = [...new Set(renglones.flatMap(r => (r.grupo !== null && r.grupo !== renglon.grupo ? [r.grupo] : [])))].sort((a, b) => a.localeCompare(b, 'es'));

            const respuesta = await Swal.fire({
                // El nombre sale del catálogo: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
                titleText: renglon.grupo === null ? `Agrupar "${renglon.nombre_servicio}"` : `Cambiar el grupo de "${renglon.nombre_servicio}"`,
                html: cuerpoDeAgrupar(existentes),
                input: 'text',
                inputValue: renglon.grupo ?? '',
                inputPlaceholder: 'Etiqueta del grupo',
                inputAttributes: { maxlength: String(GRUPO_MAX), autocomplete: 'off', 'aria-label': 'Etiqueta del grupo' },
                showCancelButton: true,
                confirmButtonText: renglon.grupo === null ? 'Agrupar' : 'Cambiar grupo',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                reverseButtons: true,
                inputValidator: valor => {
                    const etiqueta = valor.trim();
                    if (etiqueta === '') return 'Escribe la etiqueta del grupo. Para sacar el renglón de su grupo usa «Desagrupar».';
                    if (etiqueta.length > GRUPO_MAX) return `La etiqueta no puede pasar de ${GRUPO_MAX} caracteres.`;

                    // Solo difiere en mayúsculas: casi seguro es el mismo grupo tecleado distinto, y juntos no se agruparían.
                    const parecida = existentes.find(e => e !== etiqueta && e.toLocaleLowerCase('es') === etiqueta.toLocaleLowerCase('es'));
                    if (parecida !== undefined) return `Ya hay un grupo «${parecida}», que solo se diferencia en mayúsculas. Elígelo de la lista, o escribe otra etiqueta.`;

                    return null;
                },
            });
            if (!respuesta.isConfirmed) return;

            const etiqueta = String(respuesta.value).trim();
            // El validador ya lo impide; esto hace evidente que una etiqueta vacía jamás sale de aquí (el servidor la leería como «desagrupar»).
            if (etiqueta === '') return;

            const { prefactura: ficha } = await apiPrefacturas.grupo(prefactura.id, renglon.id, etiqueta);
            await cargar();

            // El servidor recorta la etiqueta con su propio criterio, que no es el de `trim()`: una hecha solo de caracteres invisibles pasa el
            // validador y llega vacía, y entonces el servidor desagrupa. Se confía en lo que devolvió, no en lo que se mandó.
            const grupoFinal = ficha.renglones?.find(r => r.id === renglon.id)?.grupo ?? null;
            if (grupoFinal === null) {
                await Swal.fire({
                    icon: 'warning',
                    titleText: 'El servicio no quedó agrupado',
                    text: `El sistema no aceptó esa etiqueta (la leyó como vacía) y «${renglon.nombre_servicio}» queda sin grupo. Escribe una etiqueta con letras o números.`,
                    confirmButtonColor: '#4f46e5',
                });
                return;
            }

            toast.fire({ icon: 'success', titleText: `«${renglon.nombre_servicio}» queda en el grupo «${grupoFinal}».` });
        });

    const desagrupar = (renglon: RenglonPrefactura) =>
        ejecutar(`grupo-${renglon.id}`, 'No se pudo desagrupar el servicio', async () => {
            await apiPrefacturas.grupo(prefactura.id, renglon.id, null);
            await cargar();
            toast.fire({ icon: 'success', titleText: `«${renglon.nombre_servicio}» sale del grupo y vuelve a salir suelto en el documento.` });
        });

    /** La cotización es lo GUARDADO en el servidor, calculado ahí: la pantalla solo abre la URL en una pestaña. */
    const cotizar = async () => {
        if (ocupado) return;

        const confirmacion = await Swal.fire({
            titleText: 'Imprimir una cotización',
            text: 'El papel lleva precios y NO es un documento emitido: no tiene folio y no consume uno. Muestra lo que está guardado en la prefactura, no lo que esté a medio capturar en pantalla.',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Sí, abrir la cotización',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4f46e5',
            reverseButtons: true,
        });
        if (!confirmacion.isConfirmed) return;

        if (window.open(urlCotizacionPrefactura(prefactura.id), '_blank') === null) {
            toast.fire({ icon: 'warning', titleText: 'No se pudo abrir la cotización: el navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.', timer: 8000 });
        }
    };

    /** Reimprimir es volver a pedir el documento: se abre en una pestaña y, si el navegador la bloquea, se avisa como en COTIZAR y en «Cerrar e imprimir». */
    const imprimir = () => {
        if (window.open(urlDocumentoPrefactura(prefactura.id), '_blank') === null) {
            toast.fire({ icon: 'warning', titleText: 'No se pudo abrir el documento: el navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.', timer: 8000 });
        }
    };

    /**
     * El cierre: sus diálogos (cambios sin guardar, confirmación, faltante) y la llamada al servidor. Lo usan «Cerrar prefactura» y
     * «Cerrar e imprimir». Dos ganchos para esta última:
     *  - `alPedirCierre` envuelve CADA petición de cierre, que es justo lo que sigue a una confirmación del operador;
     *  - `alCerrar` se llama SOLO si el cierre terminó bien (cancelar, cambios sin guardar o un rechazo del servidor retornan o lanzan
     *    antes de esa línea).
     */
    const flujoDeCierre = async (alPedirCierre: (peticion: () => Promise<RespuestaCierre>) => Promise<RespuestaCierre>, alCerrar: (cerradaAhora: Prefactura) => void) => {
        // El servidor cierra lo que tiene guardado: un encabezado o una nota a medio capturar quedarían fuera del documento sellado,
        // y una cerrada ya no se edita. Un solo aviso que dice QUÉ falta guardar.
        const sinGuardar = [...(encabezadoModificado ? ['el encabezado'] : []), ...notasPendientesRef.current];

        if (sinGuardar.length > 0) {
            const externa = notasPendientesRef.current.includes('la nota externa');

            await Swal.fire({
                icon: 'warning',
                titleText: 'Hay cambios sin guardar',
                text: `Guarda ${sinGuardar.join(', ')} antes de cerrar la prefactura: una cerrada ya no se puede editar.${externa ? ' La nota externa es la que se imprime en el documento, y saldría sin lo que escribiste.' : ''}`,
                confirmButtonColor: '#4f46e5',
            });
            return;
        }

        if (sinTotales) return;

        // El total se lee de la ficha vigente: tras un `sin_cobro` la ficha se recargó y el de la closure ya es viejo.
        const base = () =>
            reabierta
                ? `Conserva el folio ${prefactura.folio ?? ''}: no se consume otro. Se emite un documento nuevo y el anterior queda como versión no vigente. Total: ${formatearMonto((prefacturaRef.current ?? prefactura).total)}.`
                : `Se le asignará un folio: el folio se consume y no se puede reutilizar. Una vez cerrada, la prefactura ya no se podrá editar. Total: ${formatearMonto((prefacturaRef.current ?? prefactura).total)}.`;

        // Lo que falta por cobrar, según lo último que se leyó. null: no hay nada que confirmar. Solo se manda `confirmar_sin_cobro` si
        // quien opera confirmó ESTE aviso, y el servidor rechaza (`sin_cobro`) un cierre sin confirmar si el cobro cambió desde entonces.
        let faltante: string | null = esMontoPositivo(prefactura.por_cobrar) ? prefactura.por_cobrar : null;
        let aviso = '';

        for (;;) {
            const confirmacion = await Swal.fire({
                titleText: faltante === null ? (reabierta ? 'Cerrar de nuevo la prefactura' : 'Cerrar la prefactura') : 'Cerrar sin el cobro completo',
                text:
                    faltante === null
                        ? base()
                        : `${aviso} Faltan ${formatearMonto(faltante)} por cobrar: si la cierras así, el documento sale con el cobro incompleto y ya no se podrá corregir. ${base()}`.trim(),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: faltante === null ? 'Sí, cerrar' : 'Sí, cerrar sin cobro completo',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: faltante === null ? '#059669' : '#d97706',
                reverseButtons: true,
            });
            if (!confirmacion.isConfirmed) return;

            try {
                // Se manda la cifra que el operador VIO: el servidor la compara con el faltante real dentro del cierre y, si ya es otro,
                // responde `sin_cobro` con el nuevo en lugar de cerrar (abajo, otra vuelta del bucle con otra confirmación).
                const { prefactura: cerradaAhora, message } = await alPedirCierre(() => apiPrefacturas.cerrar(prefactura.id, faltante !== null, faltante ?? undefined));
                aplicar(cerradaAhora);
                setAvisoCargos(null);
                toast.fire({ icon: 'success', titleText: message });
                alCerrar(cerradaAhora);

                return;
            } catch (e) {
                const nuevo = e instanceof ErrorApi && e.codigo === 'sin_cobro' && typeof e.cuerpo.faltante === 'string' ? e.cuerpo.faltante : null;
                if (!(e instanceof ErrorApi) || nuevo === null) throw e;

                // Alguien cobró o editó entre la lectura y el envío: lo que la pantalla creía ya no vale. No se reintenta solo:
                // se pone al día la ficha y se vuelve a pedir la confirmación, con el faltante que dijo el servidor.
                await cargar();
                aviso = `${e.message} ${faltante === null ? 'La pantalla mostraba el cobro completo.' : `La pantalla mostraba que faltaban ${formatearMonto(faltante)}.`}`;
                faltante = nuevo;
            }
        }
    };

    /**
     * `imprimirAlCerrar`: «Cerrar e imprimir». Es el MISMO cierre; al terminar bien, el documento se abre en una pestaña.
     *
     * La pestaña se abre en `alPedirCierre`: justo DESPUÉS de que el operador pulsó «Sí, cerrar» y justo ANTES de la petición. Ese
     * clic es el gesto que autoriza al navegador a abrir una pestaña, y esa autorización caduca (según los navegadores que conocemos,
     * a los pocos segundos; la duración exacta no se midió aquí); la petición de red puede tardar más, así que abrirla después de
     * esperarla arriesgaría perderla y que el bloqueador de emergentes la impidiera. Y no antes: abierta durante los diálogos,
     * robaría el foco mientras el operador decide y quedaría en blanco si cancela o hay cambios sin guardar.
     * Quién cierra la pestaña que no se usa: si la petición falla (error del servidor, o `sin_cobro` antes de su segundo diálogo), el
     * `catch` del propio `alPedirCierre`; el `finally` es la red para el sello que no cuadra y para cualquier lanzamiento inesperado.
     */
    const cerrar = (imprimirAlCerrar = false) =>
        // Dos claves: así el indicador «CERRANDO…» sale en el botón que el operador pulsó y no en el otro.
        ejecutar(imprimirAlCerrar ? 'cerrar-e-imprimir' : 'cerrar', 'No se pudo cerrar la prefactura', async () => {
            let pestana: Window | null = null;
            const cerrarPestana = () => {
                pestana?.close();
                pestana = null;
            };

            try {
                await flujoDeCierre(
                    async peticion => {
                        if (imprimirAlCerrar) pestana = window.open('', '_blank');

                        try {
                            return await peticion();
                        } catch (e) {
                            cerrarPestana();
                            throw e;
                        }
                    },
                    cerradaAhora => {
                        if (!imprimirAlCerrar) return;

                        // El servidor no imprime un sello que no cuadra o que no se pudo verificar (409 / 422): no se navega la pestaña a un
                        // error (el `finally` la cierra), se le dice al operador por qué no hay papel y la ficha ya muestra los avisos del sello.
                        if (cerradaAhora.sello_discrepa !== false) {
                            toast.fire({ icon: 'warning', titleText: `Prefactura cerrada con folio ${cerradaAhora.folio ?? '—'}, pero el documento no se pudo emitir: el sello no cuadra o no se pudo verificar. La ficha lo explica.`, timer: 10000 });

                            return;
                        }

                        if (pestana === null || pestana.closed) {
                            // No se abrió (bloqueador) o el operador la cerró: el cierre ya se hizo, y la impresión se recupera con el botón.
                            toast.fire({ icon: 'info', titleText: `Prefactura cerrada con folio ${cerradaAhora.folio ?? '—'}. No se abrió la pestaña del documento: imprímelo con el botón IMPRIMIR.`, timer: 8000 });

                            return;
                        }

                        pestana.location.href = urlDocumentoPrefactura(cerradaAhora.id);
                        pestana = null;
                    },
                );
            } finally {
                cerrarPestana();
            }
        });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={prefactura.folio === null ? 'Prefactura en borrador' : `Prefactura ${prefactura.folio}`} />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <CabeceraPantalla titulo={`Prefactura ${prefactura.matricula ?? ''}`.trim()} descripcion={cerrada ? 'Documento cerrado: solo lectura' : reabierta ? 'Reabierta: corrige y vuelve a cerrarla' : descartada ? 'Borrador descartado: solo lectura' : 'Borrador: captura el encabezado, agrega servicios y cierra'}>
                        <button type="button" onClick={volverALista} className={BOTON_SECUNDARIO}>
                            <span className="flex items-center gap-2">
                                <ArrowLeft size={14} />
                                VOLVER A LA LISTA
                            </span>
                        </button>
                    </CabeceraPantalla>

                    {cerrada && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
                            <Lock size={18} className="text-emerald-700" />
                            <p className="text-sm font-black uppercase text-emerald-800">Cerrada con folio {prefactura.folio ?? '—'}</p>
                            <p className="text-[11px] font-bold text-emerald-700">el {fechaHoraSinZona(prefactura.cerrada_at)}. Un documento emitido no se modifica.</p>
                        </div>
                    )}

                    {descartada && (
                        <div role="alert" className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-100 p-4 text-[12px] font-bold text-slate-600">
                            <Lock size={16} className="mt-0.5 shrink-0" />
                            <span>Este borrador está descartado: ya no se puede modificar ni cerrar.</span>
                        </div>
                    )}

                    {recargaFallida && (
                        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-[12px] font-bold text-red-700">
                            <TriangleAlert size={16} className="shrink-0" />
                            <span className="flex-1">No se pudo actualizar la prefactura desde el servidor. Lo que ves puede estar desactualizado: no confíes en estos datos hasta recargar.</span>
                            <button type="button" onClick={() => void cargar()} className="text-[10px] font-black uppercase text-red-800 underline hover:text-red-900">
                                Reintentar
                            </button>
                        </div>
                    )}

                    {reabierta && <AvisoDeReabierta prefactura={prefactura} />}

                    <AvisosDelServidor prefactura={prefactura} />

                    {cerrada && prefactura.sello_discrepa === false && (
                        <p className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                            <ShieldCheck size={14} />
                            El sello coincide con lo que suman los renglones.
                        </p>
                    )}

                    {/* Encabezado */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="seccion-encabezado">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h3 id="seccion-encabezado" className={`${sectionTitle} mb-0`}>
                                Encabezado
                            </h3>

                            <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase ${prefactura.tipo_destino === 'internacional' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                                <Globe size={12} />
                                {prefactura.tipo_destino === 'internacional' ? 'Internacional' : 'Nacional'}
                            </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="encabezado-matricula" className={labelStyle}>
                                    Matrícula
                                </label>
                                <input id="encabezado-matricula" type="text" value={prefactura.matricula ?? ''} disabled readOnly className={campoConError(false)} />
                                <p className="mt-1 text-[10px] font-bold text-slate-400 italic">La matrícula no se cambia una vez creada la prefactura.</p>
                            </div>

                            <div>
                                <label htmlFor="encabezado-cliente" className={labelStyle}>
                                    Cliente
                                </label>
                                <SelectorCliente
                                    id="encabezado-cliente"
                                    valor={soloLectura ? prefactura.cliente_id : form.clienteId}
                                    nombreActual={soloLectura ? prefactura.cliente : form.clienteNombre}
                                    onChange={cliente => {
                                        setForm(previo => (previo === null ? previo : { ...previo, clienteId: cliente?.id ?? null, clienteNombre: cliente?.nombre ?? null }));
                                        setErroresForm(previos => (previos.cliente_id ? { ...previos, cliente_id: undefined } : previos));
                                    }}
                                    disabled={soloLectura}
                                    error={erroresForm.cliente_id}
                                />
                                {erroresForm.cliente_id && <p className={errorStyle}>{erroresForm.cliente_id}</p>}
                            </div>

                            <div>
                                <label htmlFor="encabezado-llegada" className={labelStyle}>
                                    Llegada
                                </label>
                                <input
                                    id="encabezado-llegada"
                                    type="datetime-local"
                                    value={soloLectura ? aCampoFechaHora(prefactura.llegada_at) : form.llegada}
                                    disabled={soloLectura}
                                    onChange={e => cambiar('llegada', e.target.value, 'llegada_at')}
                                    className={campoConError(!!erroresForm.llegada_at)}
                                    aria-invalid={erroresForm.llegada_at ? true : undefined}
                                />
                                {erroresForm.llegada_at && <p className={errorStyle}>{erroresForm.llegada_at}</p>}
                            </div>

                            <div>
                                <label htmlFor="encabezado-salida" className={labelStyle}>
                                    Salida
                                </label>
                                <input
                                    id="encabezado-salida"
                                    type="datetime-local"
                                    value={soloLectura ? aCampoFechaHora(prefactura.salida_at) : form.salida}
                                    min={soloLectura ? undefined : form.llegada || undefined}
                                    disabled={soloLectura}
                                    onChange={e => cambiar('salida', e.target.value, 'salida_at')}
                                    className={campoConError(!!erroresForm.salida_at)}
                                    aria-invalid={erroresForm.salida_at ? true : undefined}
                                />
                                {erroresForm.salida_at && <p className={errorStyle}>{erroresForm.salida_at}</p>}
                            </div>

                            <div>
                                <label htmlFor="encabezado-origen" className={labelStyle}>
                                    Origen
                                </label>
                                <input
                                    id="encabezado-origen"
                                    type="text"
                                    autoComplete="off"
                                    maxLength={TEXTO_MAX}
                                    value={soloLectura ? (prefactura.origen ?? '') : form.origen}
                                    disabled={soloLectura}
                                    onChange={e => cambiar('origen', e.target.value, 'origen')}
                                    className={campoConError(!!erroresForm.origen)}
                                    aria-invalid={erroresForm.origen ? true : undefined}
                                />
                                {erroresForm.origen && <p className={errorStyle}>{erroresForm.origen}</p>}
                            </div>

                            <div>
                                <label htmlFor="encabezado-destino" className={labelStyle}>
                                    Destino
                                </label>
                                <input
                                    id="encabezado-destino"
                                    type="text"
                                    autoComplete="off"
                                    maxLength={TEXTO_MAX}
                                    value={soloLectura ? (prefactura.destino ?? '') : form.destino}
                                    disabled={soloLectura}
                                    onChange={e => cambiar('destino', e.target.value, 'destino')}
                                    className={campoConError(!!erroresForm.destino)}
                                    aria-invalid={erroresForm.destino ? true : undefined}
                                />
                                {erroresForm.destino && <p className={errorStyle}>{erroresForm.destino}</p>}
                            </div>
                        </div>

                        {!soloLectura && (
                            <div className="mt-4 flex items-center justify-end gap-3">
                                {encabezadoModificado && <span className="text-[10px] font-bold uppercase text-amber-600">Cambios sin guardar</span>}
                                <button type="button" onClick={() => void guardarEncabezado()} disabled={!encabezadoModificado || ocupado} className={BOTON_PRIMARIO}>
                                    <Save size={14} />
                                    {guardandoEncabezado ? 'GUARDANDO…' : 'GUARDAR ENCABEZADO'}
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Renglones */}
                    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="seccion-renglones">
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <h3 id="seccion-renglones" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {renglones.length} {renglones.length === 1 ? 'renglón' : 'renglones'}
                            </h3>

                            {!soloLectura && (
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setModal('renglon')} disabled={ocupado} className={BOTON_PRIMARIO}>
                                        <Plus size={14} />
                                        AGREGAR SERVICIO
                                    </button>
                                    <button type="button" onClick={() => setModal('estancia')} disabled={ocupado} className={BOTON_SECUNDARIO}>
                                        <span className="flex items-center gap-2">
                                            <RefreshCw size={14} />
                                            RECALCULAR ESTANCIA
                                        </span>
                                    </button>
                                    {prefactura.tipo_destino === 'nacional' && (
                                        <button type="button" onClick={() => void marcarInternacional()} disabled={ocupado} className={BOTON_SECUNDARIO}>
                                            <span className="flex items-center gap-2">
                                                <Globe size={14} />
                                                MARCAR INTERNACIONAL
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {!soloLectura && (
                            <p className="border-b border-slate-100 bg-slate-50 px-6 py-2 text-[11px] font-bold italic text-slate-500">
                                La cantidad de un renglón no se edita: para corregirla, quítalo y vuelve a agregarlo con la cantidad correcta.
                            </p>
                        )}

                        {avisoCargos && (
                            <div role="status" className="flex items-start justify-between gap-3 border-b border-sky-100 bg-sky-50 px-6 py-3 text-[12px] font-bold text-sky-800">
                                <span>{avisoCargos}</span>
                                <button type="button" onClick={() => setAvisoCargos(null)} className="shrink-0 text-sky-500 hover:text-sky-700" aria-label="Cerrar aviso">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[720px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400">Servicio</th>
                                        <th className={`${TH} text-right`}>Precio unitario</th>
                                        <th className={TH}>Cantidad</th>
                                        <th className={`${TH} text-right`}>Importe</th>
                                        {!soloLectura && <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">Acciones</th>}
                                    </tr>
                                </thead>

                                <tbody>
                                    {renglones.length === 0 && (
                                        <tr>
                                            <td colSpan={soloLectura ? 4 : 5} className="px-6 py-16 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Sin renglones
                                            </td>
                                        </tr>
                                    )}

                                    {renglones.map(renglon => (
                                        <tr key={renglon.id} className={`border-b border-slate-50 ${esConceptoDeEstancia(renglon.concepto) ? 'bg-sky-50/40' : ''}`}>
                                            <td className="px-6 py-4">
                                                <p className="text-[11px] font-black uppercase text-slate-800">
                                                    {renglon.nombre_servicio}
                                                    {esConceptoDeEstancia(renglon.concepto) && (
                                                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black text-sky-700" title="Cargo de estancia: lo reemplaza «Recalcular estancia».">
                                                            ESTANCIA
                                                        </span>
                                                    )}
                                                    {esConceptoComisionAmex(renglon.concepto) && (
                                                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black text-violet-700" title="Comisión de un pago con Amex: es la contrapartida de un cargo ya hecho a la tarjeta. Cortesía o quitarla deja el documento por debajo de lo que se cargó.">
                                                            COMISIÓN AMEX
                                                        </span>
                                                    )}
                                                    {renglon.es_cortesia && (
                                                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700" title="Cortesía: el renglón se ve en el documento pero no se cobra.">
                                                            CORTESÍA
                                                        </span>
                                                    )}
                                                    {renglon.grupo !== null && (
                                                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black text-indigo-700" title={`Grupo «${renglon.grupo}»: en el documento los renglones con esta etiqueta salen juntos, en una sola fila.`}>
                                                            {renglon.grupo}
                                                        </span>
                                                    )}
                                                </p>
                                                {(renglon.remision || Number(renglon.margen) > 0) && (
                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        {renglon.remision ? `Remisión ${renglon.remision}` : ''}
                                                        {renglon.remision && Number(renglon.margen) > 0 ? ' · ' : ''}
                                                        {Number(renglon.margen) > 0 ? `Margen ${Number(renglon.margen)} %` : ''}
                                                    </p>
                                                )}
                                            </td>
                                            <td className={`${TD} text-right text-[11px] font-bold text-slate-600`}>{formatearMonto(renglon.precio_unitario, 4)}</td>
                                            <td className={`${TD} text-[11px] font-bold text-slate-600`}>{renglon.cantidad}</td>
                                            <td className={`${TD} text-right text-[11px] font-black text-slate-800`}>
                                                {renglon.importe === null ? (
                                                    <span className="text-red-600" title={renglon.importe_error ?? undefined}>
                                                        No se pudo calcular
                                                    </span>
                                                ) : (
                                                    formatearMonto(renglon.importe)
                                                )}
                                            </td>
                                            {!soloLectura && (
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => void cortesia(renglon.id, renglon.nombre_servicio, !renglon.es_cortesia, renglon.concepto, renglon.grupo)}
                                                            disabled={ocupado}
                                                            aria-pressed={renglon.es_cortesia}
                                                            title={renglon.es_cortesia ? 'Quitar la cortesía: vuelve a cobrarse' : 'Marcar como cortesía: se ve en el documento pero no se cobra'}
                                                            aria-label={`${renglon.es_cortesia ? 'Quitar la cortesía de' : 'Marcar como cortesía'} ${renglon.nombre_servicio}`}
                                                            className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-black uppercase transition-colors disabled:opacity-50 ${renglon.es_cortesia ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-400 hover:text-emerald-700'}`}
                                                        >
                                                            <Gift size={12} />
                                                            Cortesía
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void agrupar(renglon)}
                                                            disabled={ocupado}
                                                            title={ocupado ? 'Hay otra operación en curso: espera a que termine.' : renglon.grupo === null ? 'Agrupar: sale en el documento junto con los renglones de la misma etiqueta' : `Cambiar de grupo (hoy «${renglon.grupo}»)`}
                                                            aria-label={`${renglon.grupo === null ? 'Agrupar' : 'Cambiar el grupo de'} ${renglon.nombre_servicio}`}
                                                            className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-400 transition-colors hover:text-indigo-700 disabled:opacity-50"
                                                        >
                                                            <Group size={12} />
                                                            {renglon.grupo === null ? 'Agrupar' : 'Cambiar grupo'}
                                                        </button>
                                                        {renglon.grupo !== null && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void desagrupar(renglon)}
                                                                disabled={ocupado}
                                                                title={ocupado ? 'Hay otra operación en curso: espera a que termine.' : `Desagrupar: sale del grupo «${renglon.grupo}» y vuelve a salir suelto`}
                                                                aria-label={`Desagrupar ${renglon.nombre_servicio}`}
                                                                className="flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                                                            >
                                                                <Ungroup size={12} />
                                                                Desagrupar
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => void quitarRenglon(renglon.id, renglon.nombre_servicio, renglon.concepto)}
                                                            disabled={ocupado}
                                                            title="Quitar"
                                                            aria-label={`Quitar ${renglon.nombre_servicio}`}
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
                    </section>

                    {/* Totales: siempre los del servidor */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="seccion-totales">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 id="seccion-totales" className={sectionTitle}>
                                    Totales
                                </h3>
                                <dl className="grid grid-cols-[auto_auto] gap-x-8 gap-y-1 text-sm">
                                    <dt className="text-[11px] font-bold uppercase text-slate-500">Subtotal</dt>
                                    <dd className="text-right font-bold text-slate-700">{formatearMonto(prefactura.subtotal)}</dd>
                                    <dt className="text-[11px] font-bold uppercase text-slate-500">IVA ({formatearTasa(prefactura.iva_tasa)})</dt>
                                    <dd className="text-right font-bold text-slate-700">{formatearMonto(prefactura.iva)}</dd>
                                    <dt className="text-[11px] font-black uppercase text-slate-800">Total</dt>
                                    <dd className="text-right text-2xl font-black text-slate-900">{formatearMonto(prefactura.total)}</dd>
                                </dl>
                                <p className="mt-2 text-[10px] font-bold italic text-slate-400">Las cifras las calcula el sistema; esta pantalla no suma nada.</p>
                            </div>

                            {cerrada && (
                                <div className="flex flex-col items-end gap-2">
                                    {motivoSinImprimir !== null && (
                                        <p role="status" className="max-w-md text-right text-[11px] font-bold text-amber-700">
                                            Imprimir está deshabilitado. {motivoSinImprimir}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {puedeReabrir && (
                                            <button
                                                type="button"
                                                onClick={() => setModal('reabrir')}
                                                disabled={ocupado}
                                                title="Deshace el cierre para corregirla: el documento actual queda guardado como versión y se conserva el folio."
                                                className={`${BOTON_SECUNDARIO} flex items-center justify-center gap-2 !px-4 !py-3`}
                                            >
                                                <LockOpen size={14} />
                                                REABRIR PARA CORREGIR
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={imprimir}
                                            disabled={motivoSinImprimir !== null}
                                            title={motivoSinImprimir ?? 'Abre el documento en una pestaña nueva.'}
                                            className={BOTON_PRIMARIO}
                                        >
                                            <Printer size={14} />
                                            IMPRIMIR
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!soloLectura && (
                                <div className="flex flex-col items-end gap-2">
                                    {sinTotales && (
                                        <p role="status" className="max-w-md text-right text-[11px] font-bold text-amber-700">
                                            Cerrar y cotizar están deshabilitados hasta corregirlo. {prefactura.totales_error ?? prefactura.cobro_error ?? 'los totales no se pudieron calcular.'}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {/* Una reabierta ya gastó su folio: no se descarta (dejaría un hueco) ni se cotiza (el servidor tampoco lo permite). */}
                                        {!reabierta && (
                                            <button type="button" onClick={() => void descartar()} disabled={ocupado} className="flex items-center justify-center gap-2 rounded border border-red-200 bg-white px-4 py-3 text-[10px] font-black text-red-600 transition-all hover:bg-red-50 disabled:opacity-50">
                                                <Ban size={14} />
                                                {accionando === 'descartar' ? 'DESCARTANDO…' : 'DESCARTAR BORRADOR'}
                                            </button>
                                        )}
                                        {!reabierta && (
                                            <button
                                                type="button"
                                                onClick={() => void cotizar()}
                                                disabled={ocupado || sinTotales}
                                                title={sinTotales ? 'No se puede cotizar mientras los totales no se puedan calcular.' : 'Abre una cotización con precios: no es un documento emitido.'}
                                                className={`${BOTON_SECUNDARIO} flex items-center justify-center gap-2 !px-4 !py-3`}
                                            >
                                                <FileText size={14} />
                                                COTIZAR
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => void cerrar()}
                                            disabled={ocupado || sinTotales}
                                            title={sinTotales ? 'No se puede cerrar mientras los totales no se puedan calcular.' : undefined}
                                            className={`${BOTON_PRIMARIO} !bg-emerald-600 hover:!bg-emerald-700 !px-6 !py-3`}
                                        >
                                            <Lock size={14} />
                                            {accionando === 'cerrar' ? 'CERRANDO…' : reabierta ? 'CERRAR DE NUEVO' : 'CERRAR PREFACTURA'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void cerrar(true)}
                                            disabled={ocupado || sinTotales}
                                            title={sinTotales ? 'No se puede cerrar mientras los totales no se puedan calcular.' : 'Cierra la prefactura y, si se cierra, abre el documento.'}
                                            className={`${BOTON_PRIMARIO} !bg-emerald-600 hover:!bg-emerald-700 !px-6 !py-3`}
                                        >
                                            <Printer size={14} />
                                            {accionando === 'cerrar-e-imprimir' ? 'CERRANDO E IMPRIMIENDO…' : reabierta ? 'CERRAR DE NUEVO E IMPRIMIR' : 'CERRAR E IMPRIMIR'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {versiones.length > 0 && <VersionesDePrefactura prefacturaId={prefactura.id} versiones={versiones} />}

                    <PanelCobro prefactura={prefactura} onCambio={cargar} onError={manejarError} />

                    <PanelNotas prefactura={prefactura} onCambio={cargar} onError={manejarError} onPendientes={alCambiarNotasPendientes} />
                </div>
            </div>

            {modal === 'renglon' && <ModalRenglon onCerrar={() => setModal(null)} onGuardar={agregarRenglon} />}
            {modal === 'estancia' && <ModalEstancia onCerrar={() => setModal(null)} onGuardar={recalcularEstancia} />}
            {modal === 'reabrir' && <ModalReabrir folio={prefactura.folio} onCerrar={() => setModal(null)} onGuardar={reabrirPrefactura} />}
        </AppLayout>
    );
}
