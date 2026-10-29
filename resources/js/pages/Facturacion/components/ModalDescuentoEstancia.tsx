import { apiPrefacturas, mensajeDeError, type RenglonPrefactura } from '@/stores/apiFacturacionCatalogos';
import { useEffect, useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, errorStyle } from './estilos';
import { formatearMonto } from './formato';
import ModalBase from './ModalBase';

/** Los tres tramos, en el orden en que los enseñaba el sistema viejo. Las etiquetas son las de la bitácora del servidor. */
const TRAMOS: { concepto: string; etiqueta: string }[] = [
    { concepto: 'estancia_pernocta', etiqueta: 'Pernocta' },
    { concepto: 'estancia_transito_2h', etiqueta: 'Tránsito de 2 horas' },
    { concepto: 'estancia_transito_12h', etiqueta: 'Tránsito de 12 horas' },
];

interface Props {
    prefacturaId: number;
    /** El renglón de estancia desde cuyo icono se abrió: de él hereda el descuento su grupo. */
    renglon: RenglonPrefactura;
    onCerrar: () => void;
    /** Aplica. Debe lanzar el ErrorApi si el servidor rechaza, para que el modal lo muestre. */
    onAplicar: (conceptos: string[]) => Promise<void>;
}

/**
 * Descontar un tramo de estancia.
 *
 * Réplica del modal del sistema viejo (`obtener_datos_modal.php`): los tres tramos con la tarifa de la matrícula, y por cada uno marcado un
 * renglón negativo. La cifra sale de la TARIFA y no de lo que la prefactura cobra, así que se puede descontar un tramo que no se cobró y se
 * puede repetir: es la decisión tomada en la spec, con su costo escrito, y la bitácora es el rastro.
 *
 * El tramo del renglón desde el que se abrió llega marcado. Un tramo sin tarifa no se puede marcar: el servidor lo rechazaría con un 422
 * después del clic.
 */
export default function ModalDescuentoEstancia({ prefacturaId, renglon, onCerrar, onAplicar }: Props) {
    const [tarifas, setTarifas] = useState<Record<string, string | null> | null>(null);
    const [elegidos, setElegidos] = useState<string[]>(renglon.concepto === null ? [] : [renglon.concepto]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;

        void (async () => {
            try {
                const { tarifas: traidas } = await apiPrefacturas.tarifasDeEstancia(prefacturaId);
                if (vivo) {
                    setTarifas(traidas);
                    // El tramo de la fila llega premarcado, pero si ya no tiene tarifa no se puede descontar: se desmarca en vez de dejar que el 422 llegue tras el clic.
                    setElegidos(previos => previos.filter(c => traidas[c] !== null && traidas[c] !== undefined));
                }
            } catch (e) {
                if (vivo) setError(mensajeDeError(e));
            } finally {
                if (vivo) setCargando(false);
            }
        })();

        return () => {
            vivo = false;
        };
    }, [prefacturaId]);

    const alternar = (concepto: string) =>
        setElegidos(previos => (previos.includes(concepto) ? previos.filter(c => c !== concepto) : [...previos, concepto]));

    const aplicar = async () => {
        setError(null);
        setGuardando(true);

        try {
            await onAplicar(elegidos);
        } catch (e) {
            setError(mensajeDeError(e));
        } finally {
            setGuardando(false);
        }
    };

    const total = elegidos.reduce((suma, concepto) => suma + Number(tarifas?.[concepto] ?? 0), 0);

    return (
        <ModalBase
            idTitulo="titulo-descuento-estancia"
            titulo="Descontar estancia"
            subtitulo={`Desde «${renglon.nombre_servicio}»`}
            tieneCambios={elegidos.length > 0}
            bloqueado={guardando}
            onCerrar={onCerrar}
            ancho="max-w-xl"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[11px] font-bold text-slate-500">
                    Por cada tramo que marques entra un renglón con la tarifa de esta matrícula en negativo. El cliente lo verá como «Descuento …» en el
                    documento.
                </p>

                {cargando && <p className="text-[11px] font-bold text-slate-400">Leyendo las tarifas…</p>}

                {!cargando && tarifas !== null && (
                    <ul className="flex flex-col gap-2">
                        {TRAMOS.map(({ concepto, etiqueta }) => {
                            const tarifa = tarifas[concepto];
                            const sinTarifa = tarifa === null || tarifa === undefined;

                            return (
                                <li key={concepto}>
                                    <label className={`flex items-center justify-between gap-4 rounded border px-3 py-2 ${sinTarifa ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                                        <span className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={elegidos.includes(concepto)}
                                                onChange={() => alternar(concepto)}
                                                disabled={sinTarifa || guardando}
                                                className="size-4 accent-indigo-600 disabled:opacity-40"
                                            />
                                            <span className={`text-[11px] font-black uppercase ${sinTarifa ? 'text-slate-400' : 'text-slate-700'}`}>{etiqueta}</span>
                                        </span>

                                        <span className="text-[11px] font-bold text-slate-600">
                                            {sinTarifa ? 'Sin tarifa: no se puede descontar' : `−${formatearMonto(tarifa)}`}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {elegidos.length > 0 && (
                    <p className="text-[11px] font-black uppercase text-slate-700">
                        Se descontará {formatearMonto(String(total))} en {elegidos.length === 1 ? '1 renglón' : `${elegidos.length} renglones`}.
                    </p>
                )}

                {error !== null && <p className={errorStyle}>{error}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} disabled={guardando} className={BOTON_SECUNDARIO}>
                        Cancelar
                    </button>
                    <button type="button" onClick={() => void aplicar()} disabled={guardando || elegidos.length === 0} className={BOTON_PRIMARIO}>
                        {guardando ? 'Aplicando…' : 'Aplicar descuento'}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
}
