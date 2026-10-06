import type { AuthUser } from '@/components/navigation';

/** El subdepartamento que da derecho a reabrir una prefactura cerrada: distinto del de capturar (`factPrefacturas`), a propósito. */
export const SUBDEPARTAMENTO_REABRIR = 'factReabrirPrefactura';

/**
 * ¿Puede este usuario reabrir una prefactura cerrada? Es el mismo criterio que aplica el servidor (`subdep:factReabrirPrefactura`):
 * el admin pasa siempre, y el resto necesita tener el subdepartamento.
 *
 * El admin se pregunta POR SEPARADO: para él `departamentos` viaja vacío (`HandleInertiaRequests::mapUser`) y el middleware lo deja pasar,
 * así que buscar solo en la lista le ocultaría la acción justo a quien sí puede usarla. Mismo patrón que `getNavModules` (`user.isAdmin`).
 *
 * Esto solo decide si se OFRECE el botón. La autoridad es el servidor: si los permisos cambian después de cargar la página, el 403 llega
 * igual y el modal lo explica.
 */
export function puedeReabrirPrefactura(user: AuthUser | null): boolean {
    if (user === null) return false;
    if (user.isAdmin) return true;

    return user.departamentos.some(departamento => departamento.subdepartamentos.some(sub => sub.nombre === SUBDEPARTAMENTO_REABRIR));
}
