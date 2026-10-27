<?php

namespace App\Rules;

use App\Models\FactServicio;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * El proveedor de un comisariato es un servicio del catálogo de facturación, y de ahí sale el
 * margen con el que se cobra. Por eso que el servicio exista no basta: tiene que ser de la
 * categoría Comisariatos. Sin esa comprobación, el id de Combustible o de un Tránsito pasaría y
 * el comisariato acabaría cobrándose con el margen y el ajuste de otro servicio.
 *
 * Además tiene que estar activo, con una excepción para las ediciones: una ficha cuyo proveedor
 * se dio de baja después de capturarla conserva ese proveedor, igual que una fecha que quedó
 * fuera de ventana conserva su fecha. Lo que se impide es ELEGIR uno de baja, no conservarlo.
 * Esa excepción solo relaja lo de «activo»; la categoría no se relaja nunca.
 *
 * Va detrás de `required` e `integer`.
 */
class ProveedorDeComisariato implements ValidationRule
{
    /** @param int|null $proveedorGuardado El proveedor que ya tiene la ficha que se edita; null en un alta. */
    public function __construct(private readonly ?int $proveedorGuardado = null) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $servicio = FactServicio::query()->with('categoria')->find($value);

        if ($servicio === null) {
            $fail('Ese proveedor no existe.');

            return;
        }

        if ($servicio->categoria?->nombre !== 'Comisariatos') {
            $fail('Ese proveedor no es de comisariato.');

            return;
        }

        $esElQueYaTenia = $this->proveedorGuardado !== null && $servicio->id === $this->proveedorGuardado;

        if ($servicio->status !== 'A' && ! $esElQueYaTenia) {
            $fail('Ese proveedor está dado de baja.');
        }
    }
}
