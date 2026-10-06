<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckSubDepartamento
{
    public function handle(Request $request, Closure $next, string $route)
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'No autenticado');
        }

        if (! $user->puedeEnSubdepartamento($route)) {
            abort(403, $user->tieneRolConSubdepartamentos() ? 'No tienes acceso a este módulo' : 'Rol no autorizado');
        }

        return $next($request);
    }
}
