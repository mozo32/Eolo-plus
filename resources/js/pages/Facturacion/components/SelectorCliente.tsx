import { apiClientes, obtenerClientesApi, type Cliente, type DatosCliente } from '@/stores/apiFacturacionCatalogos';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { campoConError, errorStyle } from './estilos';
import ModalCliente from './ModalCliente';

const ESPERA_MS = 300;
const MAXIMO_RESULTADOS = 20;

/**
 * Lo tecleado parece un RFC, para decidir en qué campo del alta ponerlo.
 *
 * El RFC mexicano son 12 dígitos y letras para persona moral y 13 para física, pero aquí NO se
 * valida: solo se adivina dónde cae mejor lo escrito. Un falso positivo no rompe nada —el usuario
 * ve el campo lleno y lo corrige—, así que la regla se queda en algo tosco a propósito: sin
 * espacios, de 10 a 13 caracteres y solo letras y dígitos.
 */
const pareceRfc = (texto: string): boolean => /^[A-Za-zÑñ&0-9]{10,13}$/.test(texto.trim());

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
    const [dandoDeAlta, setDandoDeAlta] = useState(false);

    /**
     * Da de alta el cliente y lo deja elegido en la prefactura.
     *
     * No llama a `setBusqueda`: el recién creado se añade a mano a los resultados para que el
     * combo pueda mostrarlo ya, sin esperar a que el servidor lo devuelva en otra búsqueda.
     * Si el servidor rechaza, el error sube al modal, que lo pinta campo por campo.
     */
    const guardarNuevo = async (datos: DatosCliente) => {
        const { registro } = await apiClientes.crear(datos);

        setResultados(previos => (previos.some(c => c.id === registro.id) ? previos : [registro, ...previos]));
        onChange({ id: registro.id, nombre: registro.nombre });
        setDandoDeAlta(false);
    };

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
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar cliente por nombre o RFC…"
                        autoComplete="off"
                        className="flex-1 text-[11px] border border-slate-200 p-2 rounded bg-white outline-none focus:border-blue-400"
                        aria-label="Buscar cliente"
                    />
                    <button
                        type="button"
                        onClick={() => setDandoDeAlta(true)}
                        title="Dar de alta un cliente nuevo sin salir de la prefactura"
                        className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-blue-700 border border-blue-200 bg-blue-50 px-2 py-2 rounded hover:bg-blue-100"
                    >
                        <Plus size={12} /> Nuevo
                    </button>
                </div>
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

            {dandoDeAlta && (
                <ModalCliente
                    cliente={null}
                    valoresIniciales={pareceRfc(busqueda) ? { rfc: busqueda.trim() } : { nombre: busqueda.trim() }}
                    onCerrar={() => setDandoDeAlta(false)}
                    onGuardar={guardarNuevo}
                />
            )}
        </div>
    );
}
