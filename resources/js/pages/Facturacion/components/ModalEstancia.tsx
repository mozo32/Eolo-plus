import { apiPrefacturas, ErrorApi } from '@/stores/apiFacturacionCatalogos';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle } from './estilos';
import ModalBase from './ModalBase';

const CANTIDAD_MAX = 999;

export interface CantidadesEstancia {
    pernoctas: number;
    transitos_2h: number;
    transitos_12h: number;
    ajustes_2h_12h: number;
    ajustes_12h_pernocta: number;
}

interface Props {
    /** De qué prefactura, para preguntarle al servidor las cantidades que proponen sus fechas. */
    prefacturaId: number;
    onCerrar: () => void;
    /** Recalcula. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (cantidades: CantidadesEstancia) => Promise<void>;
}

type Campo = keyof CantidadesEstancia;

interface DefinicionCampo {
    campo: Campo;
    etiqueta: string;
    nombre: string;
}

const CAMPOS_DE_ESTANCIA: DefinicionCampo[] = [
    { campo: 'pernoctas', etiqueta: 'Pernoctas', nombre: 'las pernoctas' },
    { campo: 'transitos_2h', etiqueta: 'Tránsitos de hasta 2 horas', nombre: 'los tránsitos de 2 horas' },
    { campo: 'transitos_12h', etiqueta: 'Tránsitos de hasta 12 horas', nombre: 'los tránsitos de 12 horas' },
];

const CAMPOS_DE_AJUSTE: DefinicionCampo[] = [
    { campo: 'ajustes_2h_12h', etiqueta: 'Ajustes de 2 h a 12 h', nombre: 'los ajustes de 2 h a 12 h' },
    { campo: 'ajustes_12h_pernocta', etiqueta: 'Ajustes de 12 h a pernocta', nombre: 'los ajustes de 12 h a pernocta' },
];

const CAMPOS = [...CAMPOS_DE_ESTANCIA, ...CAMPOS_DE_AJUSTE];

/**
 * Recalcular la estancia.
 *
 * Los tres tramos se PROPONEN desde la llegada y la salida: el modal se abre ya relleno y la
 * persona solo confirma. La regla la aplica el servidor (`CalculadoraEstancia`, medida contra
 * 2803 prefacturas históricas) y aquí no se duplica, porque dos copias se separan la primera
 * vez que alguien toca una.
 *
 * Siguen siendo editables a propósito: la regla acierta en el 86 % de los casos y el 14 %
 * restante —una cortesía, una estancia larga a tanto alzado— lo decide la persona.
 *
 * Los dos ajustes NO se proponen: cobran la DIFERENCIA entre dos tramos y el histórico no da
 * para derivarlos. Reemplaza los cargos de estancia que la prefactura ya tenga.
 */
export default function ModalEstancia({ prefacturaId, onCerrar, onGuardar }: Props) {
    const [valores, setValores] = useState<Record<Campo, string>>({ pernoctas: '0', transitos_2h: '0', transitos_12h: '0', ajustes_2h_12h: '0', ajustes_12h_pernocta: '0' });
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [sugerencia, setSugerencia] = useState<{ cargando: boolean; motivo: string | null }>({ cargando: true, motivo: null });

    // Las cantidades se piden al abrir. Si el servidor no puede calcularlas —faltan fechas, o
    // la consulta falla— el formulario se queda en ceros, que es como estaba antes, y lo dice:
    // quedarse callado haría pensar que la estancia es cero.
    useEffect(() => {
        let vigente = true;

        apiPrefacturas
            .estanciaSugerida(prefacturaId)
            .then(propuesta => {
                if (!vigente) return;

                setValores(previos => ({
                    ...previos,
                    pernoctas: String(propuesta.pernoctas),
                    transitos_2h: String(propuesta.transitos_2h),
                    transitos_12h: String(propuesta.transitos_12h),
                }));
                setSugerencia({ cargando: false, motivo: propuesta.motivo });
            })
            .catch(error => {
                if (!vigente) return;

                setSugerencia({
                    cargando: false,
                    motivo: `No se pudieron calcular las cantidades desde las fechas (${error instanceof Error ? error.message : 'error inesperado'}). Captúralas a mano.`,
                });
            });

        return () => {
            vigente = false;
        };
    }, [prefacturaId]);

    const tieneCambios = CAMPOS.some(({ campo }) => valores[campo] !== '0');

    const cambiar = (campo: Campo, texto: string) => {
        setValores(previos => ({ ...previos, [campo]: texto }));
        setErrores(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos: Partial<Record<Campo, string>> = {};
        const numeros = {} as CantidadesEstancia;

        for (const { campo, nombre } of CAMPOS) {
            const texto = valores[campo].trim();

            if (texto === '') nuevos[campo] = `Indica la cantidad de ${nombre} (puede ser 0).`;
            else if (!/^\d+$/.test(texto)) nuevos[campo] = `La cantidad de ${nombre} debe ser un número entero, sin signos.`;
            else if (Number(texto) > CANTIDAD_MAX) nuevos[campo] = `La cantidad de ${nombre} no puede pasar de ${CANTIDAD_MAX}.`;
            else numeros[campo] = Number(texto);
        }

        setErrores(nuevos);
        setMensajeGeneral(null);
        if (Object.keys(nuevos).length > 0) return;

        setGuardando(true);

        try {
            await onGuardar(numeros);
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    const campoNumerico = ({ campo, etiqueta }: DefinicionCampo, enfocar: boolean) => (
        <div key={campo}>
            <label htmlFor={`estancia-${campo}`} className={labelStyle}>
                {etiqueta} <span className="text-red-500">*</span>
            </label>
            <input
                id={`estancia-${campo}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoFocus={enfocar}
                value={valores[campo]}
                onChange={e => cambiar(campo, e.target.value)}
                className={campoConError(!!errores[campo])}
                aria-invalid={errores[campo] ? true : undefined}
            />
            {errores[campo] && <p className={errorStyle}>{errores[campo]}</p>}
        </div>
    );

    return (
        <ModalBase idTitulo="titulo-modal-estancia" titulo="Estancia y ajustes" subtitulo="Cuántos cargos corresponden, y los ajustes si se quedó más tiempo" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-lg">
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <p className="text-[11px] font-semibold text-slate-500">
                        {sugerencia.cargando
                            ? 'Calculando las cantidades desde la llegada y la salida…'
                            : sugerencia.motivo === null
                              ? 'Las cantidades salen de la llegada y la salida de esta prefactura. Corrígelas si hace falta.'
                              : sugerencia.motivo}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        Los cargos de estancia que ya tiene la prefactura se reemplazan por los de estas cantidades, con la tarifa de la matrícula. Pon 0 donde no haya. Una aeronave en Guarda no paga estancia.
                    </p>

                    {CAMPOS_DE_ESTANCIA.map((definicion, indice) => campoNumerico(definicion, indice === 0))}

                    <div className="border-t border-slate-200 pt-4 space-y-4">
                        <p className="text-[11px] font-semibold text-slate-500">
                            Los ajustes cobran solo la DIFERENCIA entre los dos tramos, no el tramo entero: son para una aeronave que ya pagó un tránsito y acabó quedándose más. Cada ajuste de 2 h a 12 h cobra la tarifa del tránsito de 12 horas menos la del de 2; cada uno de 12 h a
                            pernocta, la de la pernocta menos la del tránsito de 12 horas. Si falta una de las tarifas o la diferencia no es positiva, ese ajuste no se cobra y se avisa.
                        </p>

                        {CAMPOS_DE_AJUSTE.map(definicion => campoNumerico(definicion, false))}
                    </div>
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <RefreshCw size={14} />
                        {guardando ? 'RECALCULANDO…' : 'RECALCULAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
