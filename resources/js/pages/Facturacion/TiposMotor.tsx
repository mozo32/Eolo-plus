import { apiTiposMotor, type TipoMotor } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import type { CampoCatalogo } from './components/ModalCatalogo';
import PantallaCatalogo from './components/PantallaCatalogo';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Tipos de motor' }];

const campos: CampoCatalogo<TipoMotor>[] = [{ clave: 'tarifa_aterrizaje', etiqueta: 'Aterrizaje', enMensaje: 'la tarifa de aterrizaje', leer: m => m.tarifa_aterrizaje }];

/** Tipos de motor y su tarifa de aterrizaje, que heredan las matrículas con ese motor. */
export default function TiposMotor() {
    return (
        <PantallaCatalogo
            titulo="Tipos de motor"
            descripcion="Tarifa de aterrizaje que heredan las matrículas de cada tipo de motor"
            breadcrumbs={breadcrumbs}
            textoAlta="NUEVO TIPO DE MOTOR"
            tituloAlta="Nuevo tipo de motor"
            tituloEdicion="Editar tipo de motor"
            campos={campos}
            api={apiTiposMotor}
        />
    );
}
