<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckSubDepartamento
{
    /**
     * Deja pasar si el usuario tiene ALGUNO de los subdepartamentos indicados.
     *
     * Con un solo nombre -que es como lo usan casi todas las rutas- se comporta igual que
     * siempre. Varios nombres son para una acción que pertenece a dos áreas a la vez, como el
     * alta de clientes, que necesitan tanto quien administra el catálogo como quien captura
     * prefacturas. Es una lista cerrada escrita en la ruta, no un «cualquier subdepartamento».
     */
    public function handle(Request $request, Closure $next, string ...$subdepartamentos)
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'No autenticado');
        }

        $autorizado = collect($subdepartamentos)
            ->contains(fn (string $subdepartamento) => $user->puedeEnSubdepartamento($subdepartamento));

        if (! $autorizado) {
            abort(403, $user->tieneRolConSubdepartamentos() ? 'No tienes acceso a este módulo' : 'Rol no autorizado');
        }

        return $next($request);
    }
}
