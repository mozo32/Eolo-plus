import { GestionAeronaveItem } from "./GestionAeronaveForm";

export function validarGestionAeronave(form: GestionAeronaveItem): string[] {
    const faltantes: string[] = [];

    // VALIDACIONES
    if (!form.matricula.trim()) {
        faltantes.push("• Matrícula");
    }

    if (!form.tipo.trim()) {
        faltantes.push("• Tipo");
    }

    if (!form.tipoAeronave || form.tipoAeronave === 0) {
        faltantes.push("• Tipo de aeronave");
    }

    return faltantes;
}
