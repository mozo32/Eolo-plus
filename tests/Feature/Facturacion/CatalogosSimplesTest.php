<?php

use App\Models\FactCategoriaServicio;
use App\Models\FactFormaPago;
use App\Models\FactProveedor;

test('los tres catalogos guardan su nombre y nacen activos', function () {
    $categoria = FactCategoriaServicio::create(['nombre' => 'Comisariatos']);
    $forma = FactFormaPago::create(['nombre' => 'AvCard by WFS']);
    $proveedor = FactProveedor::create(['nombre' => 'MANNY CATERING']);

    expect($categoria->fresh()->status)->toBe('A')
        ->and($forma->fresh()->status)->toBe('A')
        ->and($proveedor->fresh()->status)->toBe('A')
        ->and($categoria->fresh()->nombre)->toBe('Comisariatos');
});

test('el nombre es unico en los tres', function () {
    FactCategoriaServicio::create(['nombre' => 'Tránsitos']);
    FactFormaPago::create(['nombre' => 'Efectivo']);
    FactProveedor::create(['nombre' => 'EOLO']);

    expect(fn () => FactCategoriaServicio::create(['nombre' => 'Tránsitos']))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
    expect(fn () => FactFormaPago::create(['nombre' => 'Efectivo']))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
    expect(fn () => FactProveedor::create(['nombre' => 'EOLO']))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('el scope activos excluye los dados de baja en los tres', function () {
    FactCategoriaServicio::create(['nombre' => 'Viva']);
    FactCategoriaServicio::create(['nombre' => 'Baja', 'status' => 'N']);
    FactFormaPago::create(['nombre' => 'Viva']);
    FactFormaPago::create(['nombre' => 'Baja', 'status' => 'N']);
    FactProveedor::create(['nombre' => 'Vivo']);
    FactProveedor::create(['nombre' => 'Bajo', 'status' => 'N']);

    expect(FactCategoriaServicio::activos()->pluck('nombre')->all())->toBe(['Viva'])
        ->and(FactFormaPago::activos()->pluck('nombre')->all())->toBe(['Viva'])
        ->and(FactProveedor::activos()->pluck('nombre')->all())->toBe(['Vivo']);
});

/*
 * LIMITACION: las pruebas corren en sqlite en memoria, que no aplica la longitud
 * de varchar(N) ni la conserva en el esquema (Schema::getColumns y sqlite_master
 * solo ven "varchar"). Por eso esta prueba NO garantiza que la columna `nombre`
 * mida 80 en las categorías: solo fija que el modelo no trunca ni transforma un
 * nombre de 39 caracteres. La garantia de la longitud es `string('nombre', 80)`
 * en la migracion (MySQL, que si la aplica); si se toca, verificarlo a mano contra MySQL.
 */
test('la categoria admite los nombres largos del origen', function () {
    // El más largo de los datos reales.
    $nombre = 'Servicios Internacionales & Migratorios';
    $categoria = FactCategoriaServicio::create(['nombre' => $nombre]);

    expect($categoria->fresh()->nombre)->toBe($nombre);
});
