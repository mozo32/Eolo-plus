import { FILTROS_AERONAVES_VACIOS, obtenerAeronavesFacturablesApi, type AeronaveFacturable, type FiltrosAeronaves } from '@/stores/apiFacturacionCatalogos';
import { useListaPaginada } from './useListaPaginada';

/**
 * Matrículas con sus datos de cobro, contra la base de datos: el backend
 * ordena por matrícula, filtra y pagina. La máquina de paginación, búsqueda con
 * espera y corrección de página es `useListaPaginada`.
 */
export function useAeronavesFacturables() {
    return useListaPaginada<AeronaveFacturable, FiltrosAeronaves>({
        obtener: obtenerAeronavesFacturablesApi,
        vacios: FILTROS_AERONAVES_VACIOS,
        mensajeError: 'No se pudieron cargar las matrículas.',
    });
}
