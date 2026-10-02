import { ErrorApi, apiPrefacturas, obtenerAeronavesFacturablesApi, obtenerLlegadasDeMatriculaApi, type AeronaveFacturable, type LlegadaOperacion } from '@/stores/apiFacturacionCatalogos';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import { fechaHoraSinZona, fechaIsoMexico } from './formato';
import ModalBase from './ModalBase';

const ESPERA_MS = 350;
const MAXIMO_CANDIDATAS = 5;

interface Props {
    onCerrar: () => void;
    /** Recibe el id del borrador recién creado: la lista lleva al editor. */
    onCreada: (id: number) => void;
}

type TipoDestino = 'nacional' | 'internacional';

type BusquedaMatricula = { estado: 'vacia' } | { estado: 'buscando' } | { estado: 'error'; mensaje: string } | { estado: 'listo'; coincidencias: AeronaveFacturable[] };

/** Lo que respondió el servidor para UNA matrícula; si el usuario ya tecleó otra, la respuesta no aplica. */
type ResultadoBusqueda = { clave: string; resultado: { mensaje: string } | { coincidencias: AeronaveFacturable[] } };
type ResultadoLlegadas = { clave: string; llegadas: LlegadaOperacion[]; error: string | null };

/** "2026-09-30 14:30:00", tal como guarda el servidor las fechas sin zona de la prefactura. */
function llegadaComoTexto(llegada: LlegadaOperacion): string | null {
    const fecha = fechaIsoMexico(llegada.fecha);

    return fecha === null ? null : `${fecha} ${llegada.hora.slice(0, 8)}`;
}

/**
 * Alta de un borrador. Pide lo único que el servidor exige: la matrícula y si el
 * destino es nacional o internacional. El cliente y las fechas se completan en el
 * editor.
 *
 * Al teclear una matrícula que existe, se ofrecen sus llegadas recientes de
 * Operaciones Diarias para precargar fecha, hora y lugar, y se graba el vínculo
 * si se usa una. La falta de operaciones NO bloquea: sin ellas, o si no se pueden
 * consultar, el borrador se crea igual.
 */
export default function ModalNuevaPrefactura({ onCerrar, onCreada }: Props) {
    const [matricula, setMatricula] = useState('');
    const [respuestaBusqueda, setRespuestaBusqueda] = useState<ResultadoBusqueda | null>(null);
    const [tipoDestino, setTipoDestino] = useState<TipoDestino>('nacional');

    const [respuestaLlegadas, setRespuestaLlegadas] = useState<ResultadoLlegadas | null>(null);
    const [llegadaElegida, setLlegadaElegida] = useState<number | null>(null);

    const [errorMatricula, setErrorMatricula] = useState<string | null>(null);
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const limpia = matricula.trim().toUpperCase();

    const busqueda: BusquedaMatricula =
        limpia === ''
            ? { estado: 'vacia' }
            : respuestaBusqueda?.clave !== limpia
              ? { estado: 'buscando' }
              : 'mensaje' in respuestaBusqueda.resultado
                ? { estado: 'error', mensaje: respuestaBusqueda.resultado.mensaje }
                : { estado: 'listo', coincidencias: respuestaBusqueda.resultado.coincidencias };

    const aeronave = busqueda.estado === 'listo' ? (busqueda.coincidencias.find(a => a.matricula?.toUpperCase() === limpia) ?? null) : null;

    // La matrícula se busca en el catálogo de aeronaves de facturación cuando el usuario deja de teclear.
    useEffect(() => {
        if (limpia === '') return;

        let vigente = true;

        const temporizador = setTimeout(async () => {
            try {
                const pagina = await obtenerAeronavesFacturablesApi({ q: limpia, estatus: '', sin_categoria: false }, 1, 10);
                if (vigente) setRespuestaBusqueda({ clave: limpia, resultado: { coincidencias: pagina.data } });
            } catch (e) {
                if (vigente) setRespuestaBusqueda({ clave: limpia, resultado: { mensaje: e instanceof Error ? e.message : 'No se pudo buscar la matrícula.' } });
            }
        }, ESPERA_MS);

        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [limpia]);

    // Las llegadas se ofrecen solo cuando la matrícula está completa y existe.
    const matriculaEncontrada = aeronave?.matricula ?? null;

    useEffect(() => {
        if (matriculaEncontrada === null) return;

        let vigente = true;

        obtenerLlegadasDeMatriculaApi(matriculaEncontrada)
            .then(lista => {
                if (vigente) setRespuestaLlegadas({ clave: matriculaEncontrada, llegadas: lista.filter(l => llegadaComoTexto(l) !== null), error: null });
            })
            .catch(e => {
                // Sin operaciones se puede crear igual: aquí solo se avisa.
                if (vigente) setRespuestaLlegadas({ clave: matriculaEncontrada, llegadas: [], error: e instanceof Error ? e.message : 'No se pudieron consultar las operaciones.' });
            });

        return () => {
            vigente = false;
        };
    }, [matriculaEncontrada]);

    const vigentesLlegadas = matriculaEncontrada !== null && respuestaLlegadas?.clave === matriculaEncontrada ? respuestaLlegadas : null;
    const llegadas = vigentesLlegadas?.llegadas ?? [];
    const llegadasError = vigentesLlegadas?.error ?? null;
    // Una elección que ya no está en la lista (se cambió de matrícula) no cuenta.
    const llegadaUsada = llegadas.find(l => l.id === llegadaElegida) ?? null;

    const tieneCambios = matricula !== '' || tipoDestino !== 'nacional';

    const crear = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        setMensajeGeneral(null);

        if (limpia === '') {
            setErrorMatricula('Captura la matrícula.');
            return;
        }

        if (aeronave === null) {
            setErrorMatricula(busqueda.estado === 'buscando' ? 'Espera a que termine la búsqueda de la matrícula.' : 'Esa matrícula no está en el catálogo de aeronaves.');
            return;
        }

        setErrorMatricula(null);
        setGuardando(true);

        const llegada = llegadaUsada;

        try {
            // El borrador siempre se abre nacional: el paquete internacional se agrega con su propia acción, y abrirlo
            // ya como internacional dejaría sin forma de agregarlo desde el editor.
            const datos: Record<string, unknown> = { aeronave_id: aeronave.aeronave_id, tipo_destino: 'nacional' };

            if (llegada) {
                datos.llegada_at = llegadaComoTexto(llegada);
                datos.origen = llegada.lugar;
                datos.operacion_llegada_id = llegada.id;
            }

            const { prefactura } = await apiPrefacturas.crear(datos);

            if (tipoDestino === 'internacional') {
                try {
                    const { renglones, motivo } = await apiPrefacturas.internacional(prefactura.id);

                    // Un 200 no basta: con `renglones` 0 el servidor no agregó nada y dejó el borrador nacional, y con un motivo el paquete
                    // quedó incompleto (cobra de menos). En los dos casos hay que decirlo ahora, porque el editor no vuelve a avisar.
                    if (renglones === 0 || motivo !== null) {
                        await Swal.fire({
                            icon: 'warning',
                            titleText: renglones === 0 ? 'El borrador se creó como nacional' : 'El paquete internacional quedó incompleto',
                            text: motivo ?? 'No se agregó ningún servicio del paquete internacional. Puedes marcarlo internacional desde el editor.',
                            confirmButtonColor: '#4f46e5',
                        });
                    }
                } catch (error) {
                    await Swal.fire({
                        icon: 'warning',
                        titleText: 'El borrador se creó como nacional',
                        text: `${error instanceof Error ? error.message : 'Error inesperado'} Puedes marcarlo internacional desde el editor.`,
                        confirmButtonColor: '#4f46e5',
                    });
                }
            }

            onCreada(prefactura.id);
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                const { aeronave_id: deMatricula, ...otros } = error.errors;
                if (deMatricula) setErrorMatricula(deMatricula[0]);
                const resto = Object.values(otros).flat();
                if (resto.length > 0) setMensajeGeneral(resto.join(' '));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
            setGuardando(false);
        }
    };

    return (
        <ModalBase idTitulo="titulo-modal-nueva-prefactura" titulo="Nueva prefactura" subtitulo="Abre un borrador y complétalo en el editor" tieneCambios={tieneCambios && !guardando} onCerrar={onCerrar} ancho="max-w-xl">
            <form onSubmit={crear} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Datos mínimos</h4>

                    <div>
                        <label htmlFor="nueva-matricula" className={labelStyle}>
                            Matrícula <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="nueva-matricula"
                            type="text"
                            autoFocus
                            autoComplete="off"
                            value={matricula}
                            onChange={e => {
                                setMatricula(e.target.value.toUpperCase());
                                setErrorMatricula(null);
                            }}
                            className={campoConError(!!errorMatricula)}
                            aria-invalid={errorMatricula ? true : undefined}
                        />
                        {errorMatricula && <p className={errorStyle}>{errorMatricula}</p>}

                        {busqueda.estado === 'buscando' && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Buscando…</p>}
                        {busqueda.estado === 'error' && <p className={errorStyle}>{busqueda.mensaje}</p>}
                        {busqueda.estado === 'listo' && aeronave && (
                            <p className="mt-1 text-[10px] font-bold text-emerald-600">
                                {aeronave.matricula} encontrada · {aeronave.estatus === 'guarda' ? 'Guarda' : 'Tránsito'}
                            </p>
                        )}
                        {busqueda.estado === 'listo' && !aeronave && busqueda.coincidencias.length === 0 && <p className="mt-1 text-[10px] font-bold text-amber-600">Ninguna matrícula del catálogo coincide.</p>}
                        {busqueda.estado === 'listo' && !aeronave && busqueda.coincidencias.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {busqueda.coincidencias.slice(0, MAXIMO_CANDIDATAS).map(c => (
                                    <button key={c.id} type="button" onClick={() => setMatricula((c.matricula ?? '').toUpperCase())} className="rounded border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100">
                                        {c.matricula}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="nueva-destino" className={labelStyle}>
                            Destino <span className="text-red-500">*</span>
                        </label>
                        <select id="nueva-destino" value={tipoDestino} onChange={e => setTipoDestino(e.target.value as TipoDestino)} className={campoConError(false)}>
                            <option value="nacional">Nacional</option>
                            <option value="internacional">Internacional</option>
                        </select>
                        {tipoDestino === 'internacional' && <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Al crearla se agregan los servicios del paquete internacional.</p>}
                    </div>
                </div>

                {aeronave && (llegadas.length > 0 || llegadasError) && (
                    <div className="border bg-slate-50 p-5 space-y-3">
                        <h4 className={sectionTitle}>Llegada de Operaciones Diarias</h4>

                        {llegadasError && <p className="text-[11px] font-semibold text-amber-700">No se pudieron consultar las llegadas ({llegadasError}). Puedes crear el borrador sin ellas.</p>}

                        {llegadas.length > 0 && (
                            <fieldset className="space-y-2">
                                <legend className="mb-1 text-[11px] font-semibold text-slate-500">
                                    Solo se muestran las llegadas que todavía no tienen prefactura. Si una es la que se va a prefacturar, úsala para precargar la fecha, la hora y el origen.
                                </legend>

                                {llegadas.map(l => (
                                    <label key={l.id} className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 bg-white px-3 py-2">
                                        <input type="radio" name="llegada" checked={llegadaUsada?.id === l.id} onChange={() => setLlegadaElegida(l.id)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                                        <span className="text-[11px] font-bold text-slate-700">
                                            {fechaHoraSinZona(llegadaComoTexto(l))}
                                            <span className="font-semibold text-slate-500"> · desde {l.lugar ?? 'origen no capturado'}</span>
                                        </span>
                                    </label>
                                ))}

                                <label className="flex cursor-pointer items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2">
                                    <input type="radio" name="llegada" checked={llegadaUsada === null} onChange={() => setLlegadaElegida(null)} className="h-4 w-4 accent-indigo-600" />
                                    <span className="text-[11px] font-bold text-slate-700">No usar ninguna</span>
                                </label>
                            </fieldset>
                        )}
                    </div>
                )}

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <Plus size={14} />
                        {guardando ? 'CREANDO…' : 'CREAR BORRADOR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
