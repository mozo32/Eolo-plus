import { ErrorApi, apiPrefacturas, type Prefactura } from '@/stores/apiFacturacionCatalogos';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { BOTON_PRIMARIO, campoConError, errorStyle, labelStyle, sectionTitle, toast } from './estilos';

type Campo = 'nota_interna' | 'nota_externa' | 'nota_factura';

type Notas = Record<Campo, string>;

const CAMPOS: { campo: Campo; etiqueta: string; nombre: string; max: number; ayuda: string }[] = [
    { campo: 'nota_interna', etiqueta: 'Nota interna', nombre: 'La nota interna', max: 200, ayuda: 'No se imprime en la prefactura.' },
    { campo: 'nota_externa', etiqueta: 'Nota externa (se imprime en la prefactura)', nombre: 'La nota externa', max: 200, ayuda: 'Es la única nota que sale en el documento.' },
    { campo: 'nota_factura', etiqueta: 'Nota de factura', nombre: 'La nota de factura', max: 100, ayuda: 'No se imprime en la prefactura.' },
];

const notasDe = (p: Prefactura): Notas => ({
    nota_interna: p.nota_interna ?? '',
    nota_externa: p.nota_externa ?? '',
    nota_factura: p.nota_factura ?? '',
});

const sonIguales = (a: Notas, b: Notas): boolean => a.nota_interna === b.nota_interna && a.nota_externa === b.nota_externa && a.nota_factura === b.nota_factura;

interface Props {
    prefactura: Prefactura;
    /** Recarga la ficha. */
    onCambio: () => Promise<void>;
    /** Lo que el panel no sabe resolver (la prefactura se cerró, se descartó, un 5xx). */
    onError: (e: unknown, titulo: string) => Promise<void>;
}

/**
 * Las tres notas de la prefactura. Solo la externa se imprime en el documento.
 *
 * Mismo patrón que el encabezado del editor: el botón solo se habilita si algo cambió respecto de lo guardado
 * (`sonIguales`), y una recarga de la ficha no pisa lo que se está tecleando. Solo viajan las notas que cambiaron:
 * guardar la externa no toca las otras dos, ni pisa lo que otra persona haya guardado en ellas.
 * Una cerrada (o un borrador descartado) solo se lee.
 */
export default function PanelNotas({ prefactura, onCambio, onError }: Props) {
    const soloLectura = prefactura.estado === 'cerrada' || prefactura.status === 'N';

    const guardadas = notasDe(prefactura);
    const [previas, setPrevias] = useState<Notas>(guardadas);
    const [valores, setValores] = useState<Notas>(guardadas);
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [guardando, setGuardando] = useState(false);

    // Lo guardado cambió (una recarga): lo que no se tocó se pone al día, lo que se está tecleando se conserva.
    if (!sonIguales(previas, guardadas)) {
        setPrevias(guardadas);
        setValores(actual => (sonIguales(actual, previas) ? guardadas : actual));
    }

    const modificado = !sonIguales(valores, guardadas);

    const cambiar = (campo: Campo, texto: string) => {
        setValores(actual => ({ ...actual, [campo]: texto }));
        setErrores(actual => (actual[campo] ? { ...actual, [campo]: undefined } : actual));
    };

    const guardar = async () => {
        if (guardando || !modificado) return;

        const nuevos: Partial<Record<Campo, string>> = {};
        for (const { campo, nombre, max } of CAMPOS) {
            if (valores[campo].length > max) nuevos[campo] = `${nombre} no puede pasar de ${max} caracteres.`;
        }

        setErrores(nuevos);
        if (Object.keys(nuevos).length > 0) return;

        // Solo lo que cambió; una nota vacía se manda como null para vaciarla.
        const cambios: Partial<Record<Campo, string | null>> = {};
        for (const { campo } of CAMPOS) {
            if (valores[campo] !== guardadas[campo]) cambios[campo] = valores[campo].trim() === '' ? null : valores[campo];
        }

        setGuardando(true);

        try {
            const { prefactura: guardada } = await apiPrefacturas.guardarNotas(prefactura.id, cambios);
            // Solo las notas que se mandaron: lo que se esté tecleando en las otras no se pisa. Y con lo que el servidor guardó (recorta espacios).
            const nuevas = notasDe(guardada);
            setValores(actual => ({ ...actual, ...Object.fromEntries(Object.keys(cambios).map(campo => [campo, nuevas[campo as Campo]])) }));
            toast.fire({ icon: 'success', titleText: 'Notas guardadas.' });
            await onCambio();
        } catch (error) {
            const delCampo = error instanceof ErrorApi && error.status < 500 && error.codigo === null ? Object.entries(error.errors).filter(([campo]) => CAMPOS.some(c => c.campo === campo)) : [];

            if (delCampo.length > 0) {
                setErrores(Object.fromEntries(delCampo.map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                await onError(error, 'No se pudieron guardar las notas');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="seccion-notas">
            <h3 id="seccion-notas" className={sectionTitle}>
                Notas
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
                {CAMPOS.map(({ campo, etiqueta, max, ayuda }) => (
                    <div key={campo} className={campo === 'nota_externa' ? 'md:col-span-2' : ''}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <label htmlFor={`notas-${campo}`} className={`${labelStyle} mb-0`}>
                                {etiqueta}
                            </label>
                            <span className={`text-[10px] font-bold ${valores[campo].length > max ? 'text-red-600' : 'text-slate-400'}`} aria-live="off">
                                {valores[campo].length} / {max}
                            </span>
                        </div>
                        <textarea
                            id={`notas-${campo}`}
                            rows={2}
                            maxLength={max}
                            value={valores[campo]}
                            disabled={soloLectura}
                            onChange={e => cambiar(campo, e.target.value)}
                            className={`${campoConError(!!errores[campo])} resize-y`}
                            aria-invalid={errores[campo] ? true : undefined}
                        />
                        {errores[campo] ? <p className={errorStyle}>{errores[campo]}</p> : <p className="mt-1 text-[10px] font-bold italic text-slate-400">{ayuda}</p>}
                    </div>
                ))}
            </div>

            {!soloLectura && (
                <div className="mt-4 flex items-center justify-end gap-3">
                    {modificado && <span className="text-[10px] font-bold uppercase text-amber-600">Cambios sin guardar</span>}
                    <button type="button" onClick={() => void guardar()} disabled={!modificado || guardando} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'GUARDANDO…' : 'GUARDAR NOTAS'}
                    </button>
                </div>
            )}
        </section>
    );
}
