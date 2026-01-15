<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubDepartamento
{
    public function handle(Request $request, Closure $next, string $route)
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'No autenticado');
        }

        if ($user->hasRole('admin')) {
            return $next($request);
        }

        if ($user->hasAnyRole(['empleado', 'jefe_area', 'fbo'])) {
            $tieneAcceso = $user->subdepartamentos()
                ->where('subdepartamentos.nombre', $route)
                ->exists();

            if (! $tieneAcceso) {
                abort(403, 'No tienes acceso a este módulo');
            }

            return $next($request);
        }

        abort(403, 'Rol no autorizado');
    }
}
