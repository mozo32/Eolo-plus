import { ChecklistComunicacionState, EQUIPOS_COMUNICACION } from "./ChecklistComunicacion";
import { FondoDocumentacionState } from "./FondoDocumentacion";
import { CopiadorasState } from "./Copiadoras";

interface Params {
    step: number;
    nombre: string;
    nombreQuienEntrega: string;
    nombreJefeTurnoDespacho: string;
    checklistComunicacion: ChecklistComunicacionState;
    copiadoras: CopiadorasState;
    fondoDocumentacion: FondoDocumentacionState;
    cajaFuerte: string;
}

export function validarEntregaTurno({
    step,
    nombre,
    nombreQuienEntrega,
    nombreJefeTurnoDespacho,
    checklistComunicacion,
    copiadoras,
    fondoDocumentacion,
    cajaFuerte,
}: Params): string[] {
    const faltantes: string[] = [];

    if (step >= 1) {
        if (!nombre.trim()) {
            faltantes.push("• Nombre (quien recibe)");
        }
    }

    if (step >= 2) {
        const equiposSinCargado = EQUIPOS_COMUNICACION
            .filter(({ equipo }) => {
                const item = checklistComunicacion.items[equipo];
                return !item || (item.cargado !== "si" && item.cargado !== "no");
            })
            .map(({ equipo }) => equipo);

        if (equiposSinCargado.length > 0) {
            faltantes.push(
                `• Checklist de comunicación: ${equiposSinCargado.join(", ")}`
            );
        }
    }

    if (step >= 4) {
        if (!copiadoras.funciona) {
            faltantes.push("• Copiadora: indicar si funciona");
        }

        if (!copiadoras.toner) {
            faltantes.push("• Copiadora: estado del tóner");
        }
    }

    if (step >= 5) {
        const fondo = fondoDocumentacion;

        if (fondo.fondoRecibido === "") faltantes.push("• Fondo recibido");
        if (fondo.cantidadValesGasolina === "") faltantes.push("• Cantidad de vales de gasolina");
        if (fondo.fondoEntregado === "") faltantes.push("• Fondo entregado");
        if (fondo.folioValesGasolina === "") faltantes.push("• Folio de vales de gasolina");

        if (!fondo.reporteAterisaje) {
            faltantes.push("• Reporte de aterrizajes");
        }

        if (fondo.reporteAterisaje === "si" && fondo.cantidadReporteAterisaje === "") {
            faltantes.push("• Cantidad de reportes de aterrizaje");
        }

        if (fondo.totalLlegadaOperacion === "") faltantes.push("• Total llegadas");
        if (fondo.totalSalidaOperacion === "") faltantes.push("• Total salidas");
        if (fondo.cantidadOperacionesCordinadasEntregadas === "") {
            faltantes.push("• Operaciones coordinadas entregadas");
        }
        if (fondo.cuantosWalkArounds === "") faltantes.push("• Walk-Arounds");
        if (!cajaFuerte.trim()) {
            faltantes.push("• Estado de la caja fuerte");
        }
    }

    if (step >= 6) {
        if (!nombreQuienEntrega.trim()) {
            faltantes.push("• Nombre de quien entrega");
        }

        if (!nombreJefeTurnoDespacho.trim()) {
            faltantes.push("• Jefe de despacho");
        }
    }

    return faltantes;
}
