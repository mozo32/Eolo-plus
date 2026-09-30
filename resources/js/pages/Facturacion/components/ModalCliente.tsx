import { ErrorApi, type Cliente, type DatosCliente } from '@/stores/apiFacturacionCatalogos';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, campoConError, errorStyle, labelStyle, sectionTitle } from './estilos';
import ModalBase from './ModalBase';

/** Largos máximos, iguales a los de StoreClienteRequest. */
const LIMITES = { nombre: 160, rfc: 20, correo: 120, telefono: 20 } as const;

interface Props {
    /** null: alta. */
    cliente: Cliente | null;
    onCerrar: () => void;
    /** Guarda. Debe lanzar el ErrorApi si el servidor rechaza; el modal muestra los errores por campo. */
    onGuardar: (datos: DatosCliente) => Promise<void>;
}

type Campo = keyof DatosCliente;

const aTexto = (valor: string | null | undefined): string => valor ?? '';

/** Lo opcional vacío viaja como null, no como cadena vacía. */
const aValorOpcional = (texto: string): string | null => (texto.trim() === '' ? null : texto.trim());

/**
 * Alta y edición de un cliente: nombre, RFC, correo y teléfono.
 *
 * El RFC repetido no es un error y aquí no se comprueba: el RFC genérico lo
 * comparten muchos clientes reales y el servidor lo acepta a propósito. Tampoco
 * se valida el formato del correo: lo hace el servidor y su mensaje se muestra
 * debajo del campo.
 */
export default function ModalCliente({ cliente, onCerrar, onGuardar }: Props) {
    const inicial: Record<Campo, string> = {
        nombre: aTexto(cliente?.nombre),
        rfc: aTexto(cliente?.rfc),
        correo: aTexto(cliente?.correo),
        telefono: aTexto(cliente?.telefono),
    };

    const [valores, setValores] = useState<Record<Campo, string>>(inicial);
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [mensajeGeneral, setMensajeGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const tieneCambios = (Object.keys(inicial) as Campo[]).some(c => valores[c] !== inicial[c]);

    const cambiar = (campo: Campo, valor: string) => {
        setValores(previos => ({ ...previos, [campo]: valor }));
        setErrores(previos => (previos[campo] ? { ...previos, [campo]: undefined } : previos));
    };

    const validar = (): Partial<Record<Campo, string>> => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (valores.nombre.trim() === '') nuevos.nombre = 'El nombre es obligatorio.';
        else if (valores.nombre.trim().length > LIMITES.nombre) nuevos.nombre = `El nombre no puede pasar de ${LIMITES.nombre} caracteres.`;

        return nuevos;
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const nuevos = validar();
        setErrores(nuevos);
        setMensajeGeneral(null);
        if (Object.keys(nuevos).length > 0) return;

        setGuardando(true);

        try {
            await onGuardar({
                nombre: valores.nombre.trim(),
                rfc: aValorOpcional(valores.rfc),
                correo: aValorOpcional(valores.correo),
                telefono: aValorOpcional(valores.telefono),
            });
        } catch (error) {
            if (error instanceof ErrorApi && Object.keys(error.errors).length > 0) {
                // Se muestra el mensaje del servidor tal cual, campo por campo.
                setErrores(Object.fromEntries(Object.entries(error.errors).map(([campo, mensajes]) => [campo, mensajes[0]])));
            } else {
                setMensajeGeneral(error instanceof Error ? error.message : 'Error inesperado');
            }
        } finally {
            setGuardando(false);
        }
    };

    const campo = (clave: Campo, etiqueta: string, opciones: { obligatorio?: boolean; tipo?: string; autoFocus?: boolean; inputMode?: 'email' | 'tel' } = {}) => (
        <div>
            <label htmlFor={`cliente-${clave}`} className={labelStyle}>
                {etiqueta} {opciones.obligatorio && <span className="text-red-500">*</span>}
            </label>
            <input
                id={`cliente-${clave}`}
                type={opciones.tipo ?? 'text'}
                inputMode={opciones.inputMode}
                autoFocus={opciones.autoFocus}
                autoComplete="off"
                maxLength={LIMITES[clave]}
                value={valores[clave]}
                onChange={e => cambiar(clave, e.target.value)}
                className={campoConError(!!errores[clave])}
                aria-invalid={errores[clave] ? true : undefined}
            />
            {errores[clave] && <p className={errorStyle}>{errores[clave]}</p>}
        </div>
    );

    return (
        <ModalBase
            idTitulo="titulo-modal-cliente"
            titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
            subtitulo={cliente ? cliente.nombre : 'Captura los datos y guarda'}
            tieneCambios={tieneCambios}
            onCerrar={onCerrar}
            ancho="max-w-xl"
        >
            <form onSubmit={guardar} noValidate className="space-y-5">
                <div className="border bg-slate-50 p-5 space-y-4">
                    <h4 className={sectionTitle}>Datos</h4>

                    {campo('nombre', 'Nombre', { obligatorio: true, autoFocus: true })}
                    {campo('rfc', 'RFC')}
                    {campo('correo', 'Correo', { tipo: 'email', inputMode: 'email' })}
                    {campo('telefono', 'Teléfono', { tipo: 'tel', inputMode: 'tel' })}
                </div>

                {mensajeGeneral && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{mensajeGeneral}</p>}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
                        <Save size={14} />
                        {guardando ? 'GUARDANDO…' : 'GUARDAR'}
                    </button>
                </div>
            </form>
        </ModalBase>
    );
}
