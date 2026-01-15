import { PernoctaDiaItem } from "./PernoctaDiaForm";

export type ValidationErrors = Partial<
    Record<keyof PernoctaDiaItem, string>
>;

export function validatePernoctaDia(
    data: PernoctaDiaItem
): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!data.matricula.trim()) {
        errors.matricula = "La matrícula es obligatoria";
    }

    if (!data.ubicacion.trim()) {
        errors.ubicacion = "La ubicación es obligatoria";
    }

    if (!data.nombre.trim()) {
        errors.nombre = "El nombre es obligatorio";
    }

    return errors;
}
