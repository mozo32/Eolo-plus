import { useCallback, useState } from 'react';

export type TemaPantalla = 'oscuro' | 'claro';

/** Clave propia de la pantalla pública: no toca el tema global de la aplicación. */
export const CLAVE_TEMA_PANTALLA = 'operaciones-programadas-pantalla-theme';

const leerTemaGuardado = (): TemaPantalla => {
    try {
        return window.localStorage.getItem(CLAVE_TEMA_PANTALLA) === 'claro' ? 'claro' : 'oscuro';
    } catch {
        // Storage bloqueado (modo privado, políticas de la TV): se usa el predeterminado.
        return 'oscuro';
    }
};

/**
 * Tema de la vista para televisión. Oscuro por defecto; la preferencia vive en
 * localStorage porque la ruta es pública y no hay usuario al que asociarla.
 *
 * El estado inicial se lee de forma síncrona, así el primer render ya sale con
 * el tema guardado y no se alcanza a ver el oscuro antes del claro.
 */
export function usePantallaTema() {
    const [tema, setTema] = useState<TemaPantalla>(leerTemaGuardado);

    const alternar = useCallback(() => {
        setTema(actual => {
            const siguiente: TemaPantalla = actual === 'oscuro' ? 'claro' : 'oscuro';

            try {
                window.localStorage.setItem(CLAVE_TEMA_PANTALLA, siguiente);
            } catch {
                // Sin storage el cambio sigue aplicando durante la sesión.
            }

            return siguiente;
        });
    }, []);

    return { tema, alternar, esClaro: tema === 'claro' };
}
