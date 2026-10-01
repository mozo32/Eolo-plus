import { obtenerClientesApi, type Cliente } from '@/stores/apiFacturacionCatalogos';
import { useEffect, useState } from 'react';
import { campoConError, errorStyle } from './estilos';

const ESPERA_MS = 300;
const MAXIMO_RESULTADOS = 20;

interface Props {
    id: string;
    /** Id del cliente elegido, o null. */
    valor: number | null;
    /** Nombre del cliente elegido: puede estar dado de baja y por eso no salir en la búsqueda. */
    nombreActual: string | null;
    onChange: (cliente: { id: number; nombre: string } | null) => void;
    disabled?: boolean;
    error?: string;
}

/**
 * Cliente de la prefactura, del catálogo de ACTIVOS. Los clientes crecen sin
 * techo, así que no se carga la lista entera: se busca por nombre o RFC en el
 * servidor y se elige entre los primeros resultados. El cliente que ya tiene la
 * prefactura siempre aparece, aunque se haya dado de baja después.
 */
export default function SelectorCliente({ id, valor, nombreActual, onChange, disabled, error }: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState<Cliente[]>([]);
    const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
    const [buscando, setBuscando] = useState(false);

    useEffect(() => {
        let vigente = true;

        const temporizador = setTimeout(async () => {
            setBuscando(true);

            try {
                const pagina = await obtenerClientesApi({ q: busqueda, estado: 'activas' }, 1, MAXIMO_RESULTADOS);
                if (!vigente) return;
                setResultados(pagina.data);
                setErrorBusqueda(null);
            } catch (e) {
                if (!vigente) return;
                setResultados([]);
                setErrorBusqueda(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.');
            } finally {
                if (vigente) setBuscando(false);
            }
        }, busqueda === '' ? 0 : ESPERA_MS);

        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [busqueda]);

    // El elegido va primero aunque no esté en los resultados de esta búsqueda.
    const opciones = [...(valor !== null && !resultados.some(c => c.id === valor) ? [{ id: valor, nombre: nombreActual ?? `Cliente ${valor}` }] : []), ...resultados.map(c => ({ id: c.id, nombre: c.nombre }))];

    return (
        <div className="space-y-2">
            {!disabled && (
                <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar cliente por nombre o RFC…"
                    autoComplete="off"
                    className="w-full text-[11px] border border-slate-200 p-2 rounded bg-white outline-none focus:border-blue-400"
                    aria-label="Buscar cliente"
                />
            )}

            <select
                id={id}
                value={valor === null ? '' : String(valor)}
                disabled={disabled}
                onChange={e => {
                    const elegido = opciones.find(o => String(o.id) === e.target.value);
                    onChange(elegido ?? null);
                }}
                className={campoConError(!!error)}
                aria-invalid={error ? true : undefined}
            >
                <option value="">Sin cliente</option>
                {opciones.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.nombre}
                    </option>
                ))}
            </select>

            {buscando && <p className="text-[10px] font-bold text-slate-400 italic">Buscando…</p>}
            {errorBusqueda && <p className={errorStyle}>{errorBusqueda}</p>}
            {!disabled && !buscando && !errorBusqueda && resultados.length === MAXIMO_RESULTADOS && (
                <p className="text-[10px] font-bold text-slate-400 italic">Se muestran los primeros {MAXIMO_RESULTADOS}; escribe más para acotar.</p>
            )}
            {!disabled && !buscando && !errorBusqueda && busqueda !== '' && resultados.length === 0 && <p className="text-[10px] font-bold text-slate-400 italic">Ningún cliente activo coincide.</p>}
        </div>
    );
}
