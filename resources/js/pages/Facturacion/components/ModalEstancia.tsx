import { ErrorApi } from '@/stores/apiFacturacionCatalogos';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle } from './estilos';
import ModalBase from './ModalBase';

const CANTIDAD_MAX = 999;

export interface CantidadesEstancia {
    pernoctas: number;
    transitos_2h: number;
    transitos_12h: number;
}

interface Props {
    onCerrar: () => void;
    /** Recalcula. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (cantidades: CantidadesEstancia) => Promise<void>;
}

type Campo = keyof CantidadesEstancia;

const CAMPOS: { campo: Campo; etiqueta: string; nombre: string }[] = [
    { campo: 'pernoctas', etiqueta: 'Pernoctas', nombre: 'las pernoctas' },
    { campo: 'transitos_2h', etiqueta: 'Tránsitos de hasta 2 horas', nombre: 'los tránsitos de 2 horas' },
    { campo: 'transitos_12h', etiqueta: 'Tránsitos de hasta 12 horas', nombre: 'los tránsitos de 12 horas' },
];

/**
 * Recalcular la estancia: las tres cantidades las teclea una persona (no se
 * pueden derivar de la llegada y la salida) y cero es válido en cada una.
 * Reemplaza los cargos de estancia que la prefactura ya tenga.
 */
export default function ModalEstancia({ onCerrar, onGuardar }: Props) {
    const [valores, setValores] = useState<Record<Campo, string>>({ pernoctas: '0', transitos_2h: '0', transitos_12h: '0' });
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

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

    return (
        <ModalBase idTitulo="titulo-modal-estancia" titulo="Recalcular estancia" subtitulo="Cuántos cargos de estancia corresponden" tieneCambios={tieneCambios} onCerrar={onCerrar} ancho="max-w-lg">
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <p className="text-[11px] font-semibold text-slate-500">
                        Los cargos de estancia que ya tiene la prefactura se reemplazan por los de estas cantidades, con la tarifa de la matrícula. Pon 0 donde no haya. Una aeronave en Guarda no paga estancia.
                    </p>

                    {CAMPOS.map(({ campo, etiqueta }, indice) => (
                        <div key={campo}>
                            <label htmlFor={`estancia-${campo}`} className={labelStyle}>
                                {etiqueta} <span className="text-red-500">*</span>
                            </label>
                            <input
                                id={`estancia-${campo}`}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                autoFocus={indice === 0}
                                value={valores[campo]}
                                onChange={e => cambiar(campo, e.target.value)}
                                className={campoConError(!!errores[campo])}
                                aria-invalid={errores[campo] ? true : undefined}
                            />
                            {errores[campo] && <p className={errorStyle}>{errores[campo]}</p>}
                        </div>
                    ))}
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
