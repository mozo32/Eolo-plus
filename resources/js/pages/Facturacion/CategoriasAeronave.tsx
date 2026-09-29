import { apiCategoriasAeronave, type CategoriaAeronave } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import type { CampoCatalogo } from './components/ModalCatalogo';
import PantallaCatalogo from './components/PantallaCatalogo';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Categorías de aeronave' }];

const campos: CampoCatalogo<CategoriaAeronave>[] = [
    { clave: 'tarifa_pernocta', etiqueta: 'Pernocta', enMensaje: 'la tarifa de pernocta', leer: c => c.tarifa_pernocta },
    { clave: 'tarifa_transito_2h', etiqueta: 'Tránsito 2 h', enMensaje: 'la tarifa de tránsito de 2 horas', leer: c => c.tarifa_transito_2h },
    { clave: 'tarifa_transito_12h', etiqueta: 'Tránsito 12 h', enMensaje: 'la tarifa de tránsito de 12 horas', leer: c => c.tarifa_transito_12h },
];

/**
 * Categorías de aeronave y sus tarifas de estancia. Cada matrícula hereda estas
 * tarifas salvo que tenga una propia (pantalla de aeronaves).
 */
export default function CategoriasAeronave() {
    return (
        <PantallaCatalogo
            titulo="Categorías de aeronave"
            descripcion="Tarifas de estancia que heredan las matrículas de cada categoría"
            breadcrumbs={breadcrumbs}
            textoAlta="NUEVA CATEGORÍA"
            tituloAlta="Nueva categoría"
            tituloEdicion="Editar categoría"
            campos={campos}
            api={apiCategoriasAeronave}
        />
    );
}
