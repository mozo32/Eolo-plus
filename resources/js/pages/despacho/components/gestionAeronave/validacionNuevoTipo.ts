import { NuevoTipoAeronaveItem } from "./NuevoTipoAeronave";

export function validarGestionAeronave(form: NuevoTipoAeronaveItem): string[] {
    const faltantes: string[] = [];

    // VALIDACIONES
    if (!form.nombre.trim()) {
        faltantes.push("• Nombre");
    }
    return faltantes;
}
