<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->bloquearConexionRemota();
    }

    /**
     * La conexión `remota` sale del .env y en desarrollo apunta a una MySQL
     * real con datos. Durante las pruebas se redirige a un destino que no
     * existe, de modo que cualquier uso accidental reviente en lugar de
     * escribir ahí.
     *
     * Una prueba que necesite esa conexión (por ejemplo la del importador)
     * puede sobrescribirla con `config(['database.connections.remota' => [...]])`
     * y llamar a `DB::purge('remota')`.
     */
    protected function bloquearConexionRemota(): void
    {
        config(['database.connections.remota' => [
            'driver' => 'sqlite',
            'database' => __DIR__.'/remota-bloqueada-en-pruebas/no-existe.sqlite',
            'prefix' => '',
        ]]);

        DB::purge('remota');
    }
}
