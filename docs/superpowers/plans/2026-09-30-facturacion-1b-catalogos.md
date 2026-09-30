# Bloque 1b — Catálogos de facturación · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer a Eolo-plus los catálogos que el flujo de prefactura necesitará: clientes, servicios con sus categorías, formas de pago y proveedores.

**Architecture:** Cinco tablas con prefijo `fact_`, sus endpoints y pantallas, siguiendo exactamente el patrón que el bloque 1a dejó en `app/Http/Controllers/Api/Facturacion/` y `resources/js/pages/Facturacion/`. El importador existente se extiende con un método por catálogo en vez de crear uno nuevo. No hay lógica de negocio nueva salvo el ajuste de precio de los servicios de tercero.

**Tech Stack:** Laravel 12.41 · PHP 8.2 · Pest 4.1 (sqlite en memoria) · Inertia 2 + React 19 + TypeScript 5.7 · Tailwind 4 · MySQL 8

**Spec:** `docs/superpowers/specs/2026-09-28-facturacion-catalogos-design.md`

## Global Constraints

- Tablas del módulo con prefijo `fact_`. Las rutas de API van en kebab-case y **sin** ese prefijo.
- Bajas lógicas con `status` char(1) `A`/`N`, **atómicas**: `UPDATE ... WHERE id = ? AND status = 'A'`, 409 si ya estaba dada de baja. Con su `reactivar` espejo (`WHERE id = ? AND status = 'N'`, 409 si ya estaba activa).
- Consultar requiere sesión; escribir requiere el subdepartamento de esa pantalla. Admin siempre pasa.
- Toda escritura registra en bitácora con `Bitacora::MODULO_FACTURACION_CATALOGOS`.
- **Cero es un precio válido** (cortesía): las validaciones usan `min:0`, nunca `gt:0`, y el frontend no convierte `''` en `0`.
- Los Form Requests devuelven `true` en `authorize()` y llevan mensajes en español.
- Nada fuera de `app/Services/ImportadorMatriculas.php` y `app/Console/Commands/` puede usar `DB::connection('remota')`. Hay una prueba que lo verifica.
- Fechas locales de México; nunca `toISOString()` en el frontend.
- **El baseline es 382 pruebas en verde.** Correr `php artisan test` completo antes de cada commit.
- Verificación de frontend: `npx tsc --noEmit` (solo debe quedar el error preexistente de `WalkAroundController.ts(905,5)`), `npx eslint` sin errores ni advertencias, y `npm run build`.

## Datos reales contra los que se valida

Volcado de producción cargado en la base local `fact-fbo-prod`, alcanzable por la conexión `remota`:

| Origen | Filas | Notas |
|---|---|---|
| `tb_clientes` | 195 | 195 nombres distintos, **ninguno repetido**; 1 sin RFC; 16 RFC compartidos |
| `tb_servicio` | 54 | 15 de tercero (`id > 93`); 5 con `id_categorias = 0`; 2 con 4 decimales |
| `tb_categoria_serv` | 13 | una sin servicios (`Dugaeam Fee`) |
| `tb_tip_fpago` | 7 | Visa, Mastercard, Amex, Efectivo, AvCard by WFS, Transferencia, Tarjeta Remota |
| `tb_proveedor` | 5 | EOLO, MANNY CATERING, ARTURO GARDUÑO, COMEXA, OTROS |

---

### Task 1: Clientes

El catálogo más grande y el único con datos personales. **No se deduplica**: la especificación explica por qué (195 nombres únicos, y el RFC se repite de forma legítima).

**Files:**
- Create: `database/migrations/2026_09_30_090000_create_fact_clientes_table.php`
- Create: `app/Models/FactCliente.php`
- Test: `tests/Feature/Facturacion/ClienteTest.php`

**Interfaces:**
- Consumes: nada
- Produces: `FactCliente` con `$fillable = ['nombre','rfc','correo','telefono','status']`, constantes `STATUS_ACTIVO = 'A'` y `STATUS_INACTIVO = 'N'`, scope `activos()`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/ClienteTest.php

use App\Models\FactCliente;

/*
 * Los clientes NO se deduplican por RFC: XAXX010101000 (público en general) lo
 * comparten 22 clientes sin relación entre sí en los datos reales.
 */

test('un cliente guarda sus datos de contacto', function () {
    $cliente = FactCliente::create([
        'nombre' => 'Aerolíneas de Prueba',
        'rfc' => 'AER970627QE9',
        'correo' => 'facturacion@ejemplo.com',
        'telefono' => '7221234567',
    ]);

    $guardado = $cliente->fresh();

    expect($guardado->status)->toBe('A')
        ->and($guardado->nombre)->toBe('Aerolíneas de Prueba')
        ->and($guardado->rfc)->toBe('AER970627QE9');
});

test('el RFC puede repetirse entre clientes distintos', function () {
    // Caso real: el RFC genérico de público en general.
    FactCliente::create(['nombre' => 'HIPOTECARIA ARBI', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'OLI STONE', 'rfc' => 'XAXX010101000']);
    FactCliente::create(['nombre' => 'Publico en General', 'rfc' => 'XAXX010101000']);

    expect(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(3);
});

test('un cliente puede no tener RFC ni contacto', function () {
    $cliente = FactCliente::create(['nombre' => 'Cliente sin datos']);

    expect($cliente->fresh()->rfc)->toBeNull()
        ->and($cliente->fresh()->correo)->toBeNull()
        ->and($cliente->fresh()->telefono)->toBeNull();
});

test('el RFC admite los 15 caracteres que se usan en los datos reales', function () {
    $cliente = FactCliente::create(['nombre' => 'RFC largo', 'rfc' => 'ABCD123456EFGHI']);

    expect($cliente->fresh()->rfc)->toBe('ABCD123456EFGHI')
        ->and(strlen($cliente->fresh()->rfc))->toBe(15);
});

test('el scope activos excluye los dados de baja', function () {
    FactCliente::create(['nombre' => 'Vivo']);
    FactCliente::create(['nombre' => 'De baja', 'status' => 'N']);

    expect(FactCliente::activos()->pluck('nombre')->all())->toBe(['Vivo']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/ClienteTest.php`
Expected: FAIL con `Class "App\Models\FactCliente" not found`

- [ ] **Step 3: Write the migration**

```php
<?php
// database/migrations/2026_09_30_090000_create_fact_clientes_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clientes a los que se factura.
 *
 * El RFC lleva índice pero NO es único: se repite de forma legítima. En los
 * datos reales, `XAXX010101000` (público en general) lo comparten 22 clientes
 * distintos y `XEXX010101000` (residentes en el extranjero) otros 5. El nombre
 * tampoco es único, aunque hoy no haya ninguno repetido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_clientes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 160)->index();
            $table->string('rfc', 20)->nullable()->index();
            $table->string('correo', 120)->nullable();
            $table->string('telefono', 20)->nullable();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_clientes');
    }
};
```

- [ ] **Step 4: Write the model**

```php
<?php
// app/Models/FactCliente.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactCliente extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_clientes';

    protected $fillable = ['nombre', 'rfc', 'correo', 'telefono', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/ClienteTest.php`
Expected: PASS, 5 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 387 pruebas (382 + 5)

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_30_090000_create_fact_clientes_table.php app/Models/FactCliente.php tests/Feature/Facturacion/ClienteTest.php
git commit -m "Catalogo de clientes de facturacion"
```

---

### Task 2: Categorías de servicio, formas de pago y proveedores

Tres catálogos de nombre suelto, idénticos en forma. Van juntos porque separarlos serían tres tasks que repiten el mismo código.

**Files:**
- Create: `database/migrations/2026_09_30_090100_create_fact_categorias_servicio_table.php`
- Create: `database/migrations/2026_09_30_090200_create_fact_formas_pago_table.php`
- Create: `database/migrations/2026_09_30_090300_create_fact_proveedores_table.php`
- Create: `app/Models/FactCategoriaServicio.php`
- Create: `app/Models/FactFormaPago.php`
- Create: `app/Models/FactProveedor.php`
- Test: `tests/Feature/Facturacion/CatalogosSimplesTest.php`

**Interfaces:**
- Consumes: nada
- Produces: los tres modelos con `$fillable = ['nombre','status']`, constantes `STATUS_ACTIVO`/`STATUS_INACTIVO` y scope `activos()`. `FactCategoriaServicio` además tiene `servicios()` (hasMany a `FactServicio` por `categoria_servicio_id`, que crea la Task 3).

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/CatalogosSimplesTest.php

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

test('la categoria admite los nombres largos del origen', function () {
    // El más largo de los datos reales.
    $nombre = 'Servicios Internacionales & Migratorios';
    $categoria = FactCategoriaServicio::create(['nombre' => $nombre]);

    expect($categoria->fresh()->nombre)->toBe($nombre);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/CatalogosSimplesTest.php`
Expected: FAIL con `Class "App\Models\FactCategoriaServicio" not found`

- [ ] **Step 3: Write the three migrations**

```php
<?php
// database/migrations/2026_09_30_090100_create_fact_categorias_servicio_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cómo se agrupan los servicios en la pantalla de captura: Tránsitos,
 * Comisariatos, Servicios en Plataforma. Son 13 en los datos reales, y una de
 * ellas (`Dugaeam Fee`) no tiene ningún servicio.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_categorias_servicio', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_categorias_servicio');
    }
};
```

```php
<?php
// database/migrations/2026_09_30_090200_create_fact_formas_pago_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Con qué se cobra: Visa, Amex, Efectivo, AvCard by WFS, Transferencia. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_formas_pago', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_formas_pago');
    }
};
```

```php
<?php
// database/migrations/2026_09_30_090300_create_fact_proveedores_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quién presta el servicio cuando no lo presta Eolo.
 *
 * El sistema viejo tiene la columna pero no la usa: todos sus INSERT a
 * `tb_venta` escriben `Id_proveedor = 5` fijo, sea cual sea el servicio. Se
 * trae el catálogo por si el flujo de prefactura lo aprovecha, sin reproducir
 * ese valor fijo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_proveedores', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_proveedores');
    }
};
```

- [ ] **Step 4: Write the three models**

```php
<?php
// app/Models/FactCategoriaServicio.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactCategoriaServicio extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_categorias_servicio';

    protected $fillable = ['nombre', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function servicios()
    {
        return $this->hasMany(FactServicio::class, 'categoria_servicio_id');
    }
}
```

```php
<?php
// app/Models/FactFormaPago.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactFormaPago extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_formas_pago';

    protected $fillable = ['nombre', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }
}
```

```php
<?php
// app/Models/FactProveedor.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactProveedor extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    protected $table = 'fact_proveedores';

    protected $fillable = ['nombre', 'status'];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }
}
```

La relación `servicios()` apunta a `FactServicio`, que crea la Task 3. PHP no resuelve la clase hasta invocar el método y ninguna prueba de esta task lo invoca, así que no falla.

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/CatalogosSimplesTest.php`
Expected: PASS, 4 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 391 pruebas

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_30_0901*.php database/migrations/2026_09_30_0902*.php database/migrations/2026_09_30_0903*.php app/Models/FactCategoriaServicio.php app/Models/FactFormaPago.php app/Models/FactProveedor.php tests/Feature/Facturacion/CatalogosSimplesTest.php
git commit -m "Catalogos de categorias de servicio, formas de pago y proveedores"
```

---

### Task 3: Servicios y el cálculo de su importe

El único catálogo con lógica. Saca del código del sistema viejo el recargo de terceros y los tres ajustes de precio.

**Files:**
- Create: `database/migrations/2026_09_30_090400_create_fact_servicios_table.php`
- Create: `app/Models/FactServicio.php`
- Test: `tests/Feature/Facturacion/ServicioTest.php`

**Interfaces:**
- Consumes: `FactCategoriaServicio` de la Task 2
- Produces: `FactServicio` con `$fillable = ['categoria_servicio_id','nombre','precio_unitario','es_de_tercero','margen','ajuste_precio','status']`, constantes de ajuste `AJUSTE_NINGUNO = 'ninguno'`, `AJUSTE_MAS_5 = 'mas_5'`, `AJUSTE_SIN_IVA = 'sin_iva'`, `AJUSTE_COMISION_131 = 'comision_131'`, scope `activos()`, relación `categoria()`, y **`importe(float $precio, int $cantidad): string`**, que aplica el ajuste y luego el margen. **La Task 4 y el bloque 2 consumen ese método.**

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/ServicioTest.php

use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;

/*
 * Las fórmulas salen de `altaserv.php` del sistema viejo y deben reproducirse
 * exactas: el ajuste se aplica al precio unitario ANTES del margen y de la
 * cantidad.
 */

function servicio(array $extra = []): FactServicio
{
    return FactServicio::create(array_merge([
        'categoria_servicio_id' => FactCategoriaServicio::create(['nombre' => 'Cat '.uniqid()])->id,
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 1000,
    ], $extra));
}

test('un servicio propio cobra su precio por la cantidad', function () {
    $s = servicio(['precio_unitario' => 1500.50]);

    expect($s->importe(1500.50, 2))->toBe('3001.00');
});

test('un servicio de tercero suma su margen', function () {
    // altaserv.php: $sub = ($Precio * 50) / 100; $Total = ($sub + $Precio) * $Cantidad
    $s = servicio(['es_de_tercero' => true, 'margen' => 50]);

    expect($s->importe(1000, 1))->toBe('1500.00')
        ->and($s->importe(1000, 3))->toBe('4500.00');
});

test('el ajuste mas_5 multiplica por 1.05 antes del margen', function () {
    // altaserv.php servicio 106: $Precio = ($Precio * 1.05)
    $s = servicio(['es_de_tercero' => true, 'margen' => 50, 'ajuste_precio' => 'mas_5']);

    // 1000 * 1.05 = 1050 ; 1050 + 50% = 1575
    expect($s->importe(1000, 1))->toBe('1575.00');
});

test('el ajuste sin_iva divide entre 1.16 antes del margen', function () {
    // altaserv.php servicio 107: $Precio = ($Precio / 1.16)
    $s = servicio(['es_de_tercero' => true, 'margen' => 50, 'ajuste_precio' => 'sin_iva']);

    // 1160 / 1.16 = 1000 ; 1000 + 50% = 1500
    expect($s->importe(1160, 1))->toBe('1500.00');
});

test('el ajuste comision_131 aplica la formula del servicio 113', function () {
    // altaserv.php servicio 113:
    //   $Precio1 = $Precio / 1.31; $Precio = ($Precio1 * .15) + $Precio1
    $s = servicio(['ajuste_precio' => 'comision_131']);

    // 1310 / 1.31 = 1000 ; 1000 * 0.15 + 1000 = 1150
    expect($s->importe(1310, 1))->toBe('1150.00');
});

test('un precio en cero es valido y da importe cero', function () {
    // Los 15 servicios de tercero del origen tienen precio_u = 0: se teclea al capturar.
    $s = servicio(['precio_unitario' => 0, 'es_de_tercero' => true, 'margen' => 50]);

    expect($s->importe(0, 3))->toBe('0.00');
});

test('el precio guarda cuatro decimales, como el origen', function () {
    // Combustible JET A-1 vale 26.0640 y Limpieza exterior 2105.8601.
    $s = servicio(['precio_unitario' => 26.0640]);

    expect((float) $s->fresh()->precio_unitario)->toBe(26.0640);
});

test('un servicio puede no tener categoria', function () {
    // Los 5 con id_categorias = 0 del origen: Handling, Slot MMTO, los dos de
    // ajuste de estancia y Participación Aeroportuaria.
    $s = FactServicio::create(['nombre' => 'Handling', 'precio_unitario' => 1]);

    expect($s->fresh()->categoria_servicio_id)->toBeNull()
        ->and($s->fresh()->categoria)->toBeNull();
});

test('el scope activos excluye los dados de baja', function () {
    servicio(['nombre' => 'Vivo']);
    servicio(['nombre' => 'De baja', 'status' => 'N']);

    expect(FactServicio::activos()->pluck('nombre')->all())->toBe(['Vivo']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/ServicioTest.php`
Expected: FAIL con `Class "App\Models\FactServicio" not found`

- [ ] **Step 3: Write the migration**

```php
<?php
// database/migrations/2026_09_30_090400_create_fact_servicios_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de servicios facturables.
 *
 * El sistema viejo decidía el recargo de tercero por el número de id (`> 93`) y
 * los ajustes de precio con tres `if` sobre los ids 106, 107 y 113. Aquí son
 * columnas: insertar un servicio nuevo ya no rompe la regla.
 *
 * El precio lleva cuatro decimales porque el origen los usa: `Combustible
 * JET A-1` vale 26.0640. Con dos, el cobro cambiaría.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fact_servicios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_servicio_id')
                ->nullable()
                ->constrained('fact_categorias_servicio')
                ->nullOnDelete();
            $table->string('nombre', 120)->index();
            $table->decimal('precio_unitario', 10, 4)->default(0);
            $table->boolean('es_de_tercero')->default(false);
            $table->decimal('margen', 5, 2)->default(0);
            $table->string('ajuste_precio', 16)->default('ninguno');
            $table->char('status', 1)->default('A')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fact_servicios');
    }
};
```

- [ ] **Step 4: Write the model**

```php
<?php
// app/Models/FactServicio.php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class FactServicio extends Model
{
    public const STATUS_ACTIVO = 'A';
    public const STATUS_INACTIVO = 'N';

    /** Sin ajuste: el precio se cobra tal cual. */
    public const AJUSTE_NINGUNO = 'ninguno';

    /** Servicio 106 del sistema viejo: precio × 1.05. */
    public const AJUSTE_MAS_5 = 'mas_5';

    /** Servicio 107: precio ÷ 1.16, para descontarle el IVA. */
    public const AJUSTE_SIN_IVA = 'sin_iva';

    /** Servicio 113: (precio ÷ 1.31) × 1.15. */
    public const AJUSTE_COMISION_131 = 'comision_131';

    protected $table = 'fact_servicios';

    protected $fillable = [
        'categoria_servicio_id',
        'nombre',
        'precio_unitario',
        'es_de_tercero',
        'margen',
        'ajuste_precio',
        'status',
    ];

    protected $casts = [
        'precio_unitario' => 'decimal:4',
        'margen' => 'decimal:2',
        'es_de_tercero' => 'boolean',
    ];

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVO);
    }

    public function categoria()
    {
        return $this->belongsTo(FactCategoriaServicio::class, 'categoria_servicio_id');
    }

    /**
     * Importe de una línea de prefactura, reproduciendo `altaserv.php`: primero
     * el ajuste sobre el precio unitario, después el margen, y al final la
     * cantidad. El precio se recibe por parámetro porque en los servicios de
     * tercero se teclea al capturar y no sale del catálogo.
     */
    public function importe(float $precio, int $cantidad): string
    {
        $ajustado = $this->aplicarAjuste($precio);
        $conMargen = $ajustado + ($ajustado * (float) $this->margen / 100);

        return number_format($conMargen * $cantidad, 2, '.', '');
    }

    private function aplicarAjuste(float $precio): float
    {
        return match ($this->ajuste_precio) {
            self::AJUSTE_MAS_5 => $precio * 1.05,
            self::AJUSTE_SIN_IVA => $precio / 1.16,
            self::AJUSTE_COMISION_131 => ($precio / 1.31) * 1.15,
            default => $precio,
        };
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/ServicioTest.php`
Expected: PASS, 9 pruebas

- [ ] **Step 6: Run the full suite**

Run: `php artisan test`
Expected: PASS, 400 pruebas

- [ ] **Step 7: Commit**

```bash
git add database/migrations/2026_09_30_090400_create_fact_servicios_table.php app/Models/FactServicio.php tests/Feature/Facturacion/ServicioTest.php
git commit -m "Catalogo de servicios con el recargo de terceros y los ajustes de precio"
```

---

### Task 4: Extender el importador

El importador de matrículas ya existe y funciona. Se le agregan cinco catálogos más, sin tocar lo que ya trae.

**Files:**
- Modify: `app/Services/ImportadorMatriculas.php`
- Test: `tests/Feature/Facturacion/ImportadorCatalogosTest.php`

**`tb_servicio_ter` no se importa** y es deliberado: son 12 nombres de proveedores que dos archivos del sistema viejo cargan en un `<select>` que nunca llegan a imprimir. Es código muerto.

**Interfaces:**
- Consumes: `FactCliente`, `FactCategoriaServicio`, `FactFormaPago`, `FactProveedor`, `FactServicio` de las Tasks 1 a 3
- Produces: conteos nuevos en `ResultadoImportacion::$conteos`: `clientes`, `categorias_servicio`, `servicios`, `servicios_de_tercero`, `servicios_sin_categoria`, `formas_pago`, `proveedores`

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/ImportadorCatalogosTest.php

use App\Models\FactCliente;
use App\Models\FactCategoriaServicio;
use App\Models\FactFormaPago;
use App\Models\FactProveedor;
use App\Models\FactServicio;
use App\Services\ImportadorMatriculas;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Los catálogos del bloque 1b. La conexión `remota` está bloqueada por TestCase,
 * así que hay que sobrescribirla y purgarla.
 */

function prepararOrigenCatalogos(): void
{
    config(['database.connections.remota' => ['driver' => 'sqlite', 'database' => ':memory:']]);
    DB::purge('remota');

    $esquema = Schema::connection('remota');

    $esquema->create('tb_clientes', function ($t) {
        $t->integer('id_cliente', true);
        $t->string('nombre');
        $t->string('rfc')->nullable();
        $t->string('correo')->nullable();
        $t->string('telefono')->nullable();
        $t->integer('fol_prefactura')->nullable();
    });
    $esquema->create('tb_categoria_serv', function ($t) {
        $t->integer('id_categorias', true);
        $t->string('categoras');
    });
    $esquema->create('tb_servicio', function ($t) {
        $t->integer('id_servicio', true);
        $t->string('servicio');
        $t->decimal('precio_u', 10, 4);
        $t->integer('id_categorias');
    });
    $esquema->create('tb_tip_fpago', function ($t) {
        $t->integer('id_tipo_formas', true);
        $t->string('tipo_forma');
    });
    $esquema->create('tb_proveedor', function ($t) {
        $t->integer('id_proveedor', true);
        $t->string('proveedor');
    });

    // El importador de matrículas necesita sus tablas aunque estén vacías.
    foreach ([
        'tb_tipo' => ['id_tipo', 'tipo'],
        'tb_categoria' => ['id_categoria', 'categoria'],
        'tb_motor' => ['id_motor', 'motor'],
    ] as $tabla => $cols) {
        $esquema->create($tabla, function ($t) use ($cols) {
            $t->integer($cols[0], true);
            $t->string($cols[1]);
        });
    }
    foreach (['tb_pernocta' => 'pernocta', 'tb_transito2h' => 'transito', 'tb_transito12h' => 'transito12', 'tb_aterrisaje' => 'aterrizaje'] as $tabla => $col) {
        $esquema->create($tabla, function ($t) use ($tabla, $col) {
            $t->integer('id_'.str_replace('tb_', '', $tabla), true);
            $t->decimal($col, 10, 2);
        });
    }
    $esquema->create('tb_matricula', function ($t) {
        $t->integer('id_matricula', true);
        $t->string('matricula');
        $t->integer('id_estatus');
        $t->integer('id_tipo');
        $t->integer('id_categoria');
        $t->integer('id_motor');
        $t->integer('id_aterrizaje');
        $t->integer('id_transito2h');
        $t->integer('id_transito12h');
        $t->integer('id_pernocta');
        $t->integer('d_vuelos');
    });
    $esquema->create('tb_combustible', function ($t) {
        $t->integer('id_combustible', true);
        $t->decimal('p_combustible', 10, 4);
        $t->date('f_ini');
        $t->date('f_fin');
        $t->decimal('pasa', 10, 4);
    });
}

beforeEach(fn () => prepararOrigenCatalogos());

test('los clientes se importan uno a uno, sin deduplicar por RFC', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => 'HIPOTECARIA ARBI', 'rfc' => 'XAXX010101000', 'correo' => 'a@x.com', 'telefono' => '111'],
        ['nombre' => 'OLI STONE', 'rfc' => 'XAXX010101000', 'correo' => null, 'telefono' => null],
        ['nombre' => 'AEROSAN', 'rfc' => 'AER970627QE9', 'correo' => 'b@x.com', 'telefono' => '222'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(3)
        ->and(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(2)
        ->and($resultado->conteos['clientes'])->toBe(3);
});

test('un cliente sin RFC ni contacto se importa igual', function () {
    DB::connection('remota')->table('tb_clientes')->insert([
        ['nombre' => 'Sin datos', 'rfc' => '', 'correo' => '', 'telefono' => ''],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $cliente = FactCliente::first();

    expect($cliente->nombre)->toBe('Sin datos')
        ->and($cliente->rfc)->toBeNull()
        ->and($cliente->correo)->toBeNull();
});

test('los servicios traen su categoria, su precio de cuatro decimales y su clasificacion', function () {
    DB::connection('remota')->table('tb_categoria_serv')->insert(['id_categorias' => 3, 'categoras' => 'Combustible & Servicios']);
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 7, 'servicio' => 'Combustible JET A-1', 'precio_u' => 26.0640, 'id_categorias' => 3],
        ['id_servicio' => 94, 'servicio' => 'Comisariato, Tercero', 'precio_u' => 0, 'id_categorias' => 3],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    $propio = FactServicio::where('nombre', 'Combustible JET A-1')->first();
    $tercero = FactServicio::where('nombre', 'Comisariato, Tercero')->first();

    expect((float) $propio->precio_unitario)->toBe(26.0640)
        ->and($propio->es_de_tercero)->toBeFalse()
        ->and((float) $propio->margen)->toBe(0.0)
        ->and($propio->categoria->nombre)->toBe('Combustible & Servicios')
        ->and($tercero->es_de_tercero)->toBeTrue()
        ->and((float) $tercero->margen)->toBe(50.0)
        ->and($resultado->conteos['servicios_de_tercero'])->toBe(1);
});

test('los tres servicios con formula propia traen su ajuste', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 106, 'servicio' => 'Comisariato_Manny', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 107, 'servicio' => 'Comisariato_Avemex', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 113, 'servicio' => 'Comisariato_Fly Across', 'precio_u' => 0, 'id_categorias' => 0],
        ['id_servicio' => 95, 'servicio' => 'Otro de tercero', 'precio_u' => 0, 'id_categorias' => 0],
    ]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::where('nombre', 'Comisariato_Manny')->value('ajuste_precio'))->toBe('mas_5')
        ->and(FactServicio::where('nombre', 'Comisariato_Avemex')->value('ajuste_precio'))->toBe('sin_iva')
        ->and(FactServicio::where('nombre', 'Comisariato_Fly Across')->value('ajuste_precio'))->toBe('comision_131')
        ->and(FactServicio::where('nombre', 'Otro de tercero')->value('ajuste_precio'))->toBe('ninguno');
});

test('un servicio con categoria cero queda sin clasificar y se cuenta', function () {
    DB::connection('remota')->table('tb_servicio')->insert([
        ['id_servicio' => 1, 'servicio' => 'Handling', 'precio_u' => 1, 'id_categorias' => 0],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactServicio::first()->categoria_servicio_id)->toBeNull()
        ->and($resultado->conteos['servicios_sin_categoria'])->toBe(1);
});

test('formas de pago y proveedores se importan por nombre', function () {
    DB::connection('remota')->table('tb_tip_fpago')->insert([
        ['tipo_forma' => 'Efectivo'], ['tipo_forma' => 'AvCard by WFS'],
    ]);
    DB::connection('remota')->table('tb_proveedor')->insert([
        ['proveedor' => 'EOLO'], ['proveedor' => 'MANNY CATERING'],
    ]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactFormaPago::pluck('nombre')->sort()->values()->all())->toBe(['AvCard by WFS', 'Efectivo'])
        ->and(FactProveedor::count())->toBe(2)
        ->and($resultado->conteos['formas_pago'])->toBe(2)
        ->and($resultado->conteos['proveedores'])->toBe(2);
});

test('correrlo dos veces no duplica los catalogos', function () {
    DB::connection('remota')->table('tb_clientes')->insert([['nombre' => 'Uno', 'rfc' => 'ABC010101AAA']]);
    DB::connection('remota')->table('tb_servicio')->insert([['id_servicio' => 5, 'servicio' => 'Aterrizaje', 'precio_u' => 100, 'id_categorias' => 0]]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => 'Efectivo']]);

    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);
    app(ImportadorMatriculas::class)->ejecutar(aplicar: true);

    expect(FactCliente::count())->toBe(1)
        ->and(FactServicio::count())->toBe(1)
        ->and(FactFormaPago::count())->toBe(1);
});

test('la simulacion no escribe ningun catalogo', function () {
    DB::connection('remota')->table('tb_clientes')->insert([['nombre' => 'Uno', 'rfc' => 'ABC010101AAA']]);
    DB::connection('remota')->table('tb_tip_fpago')->insert([['tipo_forma' => 'Efectivo']]);

    $resultado = app(ImportadorMatriculas::class)->ejecutar(aplicar: false);

    expect($resultado->conteos['clientes'])->toBe(1)
        ->and(FactCliente::count())->toBe(0)
        ->and(FactFormaPago::count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/ImportadorCatalogosTest.php`
Expected: FAIL — `Undefined array key "clientes"`, porque el importador todavía no los trae.

- [ ] **Step 3: Extend the importer**

En `app/Services/ImportadorMatriculas.php`, dentro del `try` de `ejecutar()` y **después** de las llamadas que ya existen, agregar:

```php
            $this->importarClientes();
            $categoriasServicio = $this->importarCategoriasServicio();
            $this->importarServicios($categoriasServicio);
            $this->importarFormasPago();
            $this->importarProveedores();
```

Y los cinco métodos nuevos:

```php
    /**
     * Los clientes se traen uno a uno, sin deduplicar.
     *
     * El RFC se repite de forma legítima: `XAXX010101000` (público en general)
     * lo comparten 22 clientes sin relación entre sí en los datos reales, y
     * `XEXX010101000` otros 5. Deduplicar por él fusionaría clientes distintos.
     * El nombre sí se usa como llave de idempotencia, para que volver a correr
     * el importador no duplique. Es seguro hoy porque los 195 nombres del
     * origen son únicos, pero no es una garantía del modelo: si aparecieran dos
     * clientes reales con el mismo nombre, esto los fusionaría. Por eso se
     * reporta como hallazgo antes de aplicar.
     */
    private function importarClientes(): void
    {
        $vistos = [];

        foreach ($this->legacy('tb_clientes')->orderBy('id_cliente')->get() as $fila) {
            $nombre = trim((string) $fila->nombre);

            if ($nombre === '') {
                continue;
            }

            if (isset($vistos[mb_strtolower($nombre)])) {
                $this->resultado->hallazgo("Cliente con nombre repetido en tb_clientes: '{$nombre}'. Se importa una sola vez; revísalo antes de aplicar.");
            }

            $vistos[mb_strtolower($nombre)] = true;

            FactCliente::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'rfc' => $this->oNulo($fila->rfc ?? null),
                    'correo' => $this->oNulo($fila->correo ?? null),
                    'telefono' => $this->oNulo($fila->telefono ?? null),
                ],
            );

            $this->resultado->contar('clientes');
        }
    }

    /** @return array<int,int> id_categorias viejo => id de fact_categorias_servicio */
    private function importarCategoriasServicio(): array
    {
        $mapa = [];

        foreach ($this->legacy('tb_categoria_serv')->get() as $fila) {
            $nombre = trim((string) $fila->categoras);

            if ($nombre === '' || (int) $fila->id_categorias === 0) {
                continue;
            }

            $mapa[$fila->id_categorias] = FactCategoriaServicio::firstOrCreate(['nombre' => $nombre])->id;
            $this->resultado->contar('categorias_servicio');
        }

        return $mapa;
    }

    /**
     * El sistema viejo decide el recargo de tercero por el número de id y los
     * ajustes con tres `if` sobre ids concretos (`altaserv.php`). Aquí esa
     * clasificación se traduce a columnas una sola vez, en la importación.
     */
    private function importarServicios(array $categorias): void
    {
        foreach ($this->legacy('tb_servicio')->orderBy('id_servicio')->get() as $fila) {
            $nombre = trim((string) $fila->servicio);

            if ($nombre === '') {
                continue;
            }

            $esDeTercero = (int) $fila->id_servicio > 93;
            $categoriaId = $categorias[$fila->id_categorias] ?? null;

            if ($categoriaId === null) {
                $this->resultado->contar('servicios_sin_categoria');
            }

            if ($esDeTercero) {
                $this->resultado->contar('servicios_de_tercero');
            }

            FactServicio::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'categoria_servicio_id' => $categoriaId,
                    'precio_unitario' => $fila->precio_u ?? 0,
                    'es_de_tercero' => $esDeTercero,
                    'margen' => $esDeTercero ? 50 : 0,
                    'ajuste_precio' => match ((int) $fila->id_servicio) {
                        106 => FactServicio::AJUSTE_MAS_5,
                        107 => FactServicio::AJUSTE_SIN_IVA,
                        113 => FactServicio::AJUSTE_COMISION_131,
                        default => FactServicio::AJUSTE_NINGUNO,
                    },
                ],
            );

            $this->resultado->contar('servicios');
        }
    }

    private function importarFormasPago(): void
    {
        foreach ($this->legacy('tb_tip_fpago')->get() as $fila) {
            $nombre = trim((string) $fila->tipo_forma);

            if ($nombre === '') {
                continue;
            }

            FactFormaPago::firstOrCreate(['nombre' => $nombre]);
            $this->resultado->contar('formas_pago');
        }
    }

    private function importarProveedores(): void
    {
        foreach ($this->legacy('tb_proveedor')->get() as $fila) {
            $nombre = trim((string) $fila->proveedor);

            if ($nombre === '') {
                continue;
            }

            FactProveedor::firstOrCreate(['nombre' => $nombre]);
            $this->resultado->contar('proveedores');
        }
    }

    /** Una cadena vacía del origen es un dato ausente, no una cadena. */
    private function oNulo(?string $valor): ?string
    {
        $valor = trim((string) $valor);

        return $valor === '' ? null : $valor;
    }
```

Agregar los `use` de los cinco modelos al principio del archivo.

- [ ] **Step 4: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/ImportadorCatalogosTest.php`
Expected: PASS, 8 pruebas

- [ ] **Step 5: Run the full suite**

Run: `php artisan test`
Expected: PASS, 408 pruebas. Las pruebas existentes del importador de matrículas deben seguir en verde sin tocarlas.

- [ ] **Step 6: Commit**

```bash
git add app/Services/ImportadorMatriculas.php tests/Feature/Facturacion/ImportadorCatalogosTest.php
git commit -m "El importador trae clientes, servicios, formas de pago y proveedores"
```

---

### Task 5: Endpoints, permisos y bitácora

**Files:**
- Create: `app/Http/Controllers/Api/Facturacion/ClienteController.php`
- Create: `app/Http/Controllers/Api/Facturacion/ServicioController.php`
- Create: `app/Http/Controllers/Api/Facturacion/CategoriaServicioController.php`
- Create: `app/Http/Controllers/Api/Facturacion/FormaPagoController.php`
- Create: `app/Http/Controllers/Api/Facturacion/ProveedorController.php`
- Create: `app/Http/Requests/Facturacion/` (un Store y un Update por catálogo)
- Modify: `database/seeders/FacturacionSubdepartamentosSeeder.php`
- Modify: `routes/api.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/Facturacion/EndpointsCatalogos1bTest.php`

**Interfaces:**
- Consumes: los cinco modelos de las Tasks 1 a 3
- Produces: rutas bajo `api/facturacion`; subdepartamentos nuevos `factClientes`, `factServicios`, `factFormasPago`, `factProveedores`

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/EndpointsCatalogos1bTest.php

use App\Models\Bitacora;
use App\Models\FactCliente;
use App\Models\FactCategoriaServicio;
use App\Models\FactServicio;

function clienteValido(array $extra = []): array
{
    return array_merge([
        'nombre' => 'Aerolíneas de Prueba',
        'rfc' => 'AER970627QE9',
        'correo' => 'facturacion@ejemplo.com',
        'telefono' => '7221234567',
    ], $extra);
}

function servicioValido(array $extra = []): array
{
    return array_merge([
        'categoria_servicio_id' => FactCategoriaServicio::create(['nombre' => 'Cat '.uniqid()])->id,
        'nombre' => 'Servicio '.uniqid(),
        'precio_unitario' => 1500.50,
        'es_de_tercero' => false,
        'margen' => 0,
        'ajuste_precio' => 'ninguno',
    ], $extra);
}

test('sin sesion no se puede consultar ni escribir', function () {
    $this->getJson('/api/facturacion/clientes')->assertUnauthorized();
    $this->postJson('/api/facturacion/clientes', clienteValido())->assertUnauthorized();
});

test('consultar es abierto a autenticados pero escribir exige el subdepartamento', function () {
    $this->actingAs(usuarioSinAcceso());

    $this->getJson('/api/facturacion/clientes')->assertOk();
    $this->postJson('/api/facturacion/clientes', clienteValido())->assertForbidden();
});

test('con el subdepartamento se da de alta un cliente y queda en bitacora', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido())
        ->assertCreated()
        ->assertJsonPath('cliente.nombre', 'Aerolíneas de Prueba');

    expect(FactCliente::count())->toBe(1)
        ->and(Bitacora::where('modulo', Bitacora::MODULO_FACTURACION_CATALOGOS)->where('accion', Bitacora::ACCION_CREAR)->exists())->toBeTrue();
});

test('el RFC repetido SI se acepta', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => 'Uno', 'rfc' => 'XAXX010101000']))->assertCreated();
    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => 'Dos', 'rfc' => 'XAXX010101000']))->assertCreated();

    expect(FactCliente::where('rfc', 'XAXX010101000')->count())->toBe(2);
});

test('el nombre del cliente es obligatorio', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/clientes', clienteValido(['nombre' => '']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['nombre']);
});

test('un servicio con precio cero se acepta', function () {
    // Los 15 de tercero del origen tienen precio 0: se teclea al capturar.
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => 0]))
        ->assertCreated();

    expect((float) FactServicio::first()->precio_unitario)->toBe(0.0);
});

test('un precio negativo o un ajuste desconocido se rechazan', function () {
    $this->actingAs(usuarioConSubdepartamento('factServicios', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido(['precio_unitario' => -1]))
        ->assertStatus(422)->assertJsonValidationErrors(['precio_unitario']);

    $this->postJson('/api/facturacion/servicios', servicioValido(['ajuste_precio' => 'inventado']))
        ->assertStatus(422)->assertJsonValidationErrors(['ajuste_precio']);
});

test('desactivar y reactivar un cliente son atomicos', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));
    $cliente = FactCliente::create(clienteValido());

    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/desactivar")->assertOk();
    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/desactivar")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_desactivado');

    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/reactivar")->assertOk();
    $this->patchJson("/api/facturacion/clientes/{$cliente->id}/reactivar")
        ->assertStatus(409)->assertJsonPath('codigo', 'ya_activo');

    expect($cliente->fresh()->status)->toBe('A');
});

test('quien tiene un subdepartamento de facturacion no puede escribir en los otros catalogos', function () {
    $this->actingAs(usuarioConSubdepartamento('factClientes', 'Facturacion'));

    $this->postJson('/api/facturacion/servicios', servicioValido())->assertForbidden();
    $this->postJson('/api/facturacion/formas-pago', ['nombre' => 'Efectivo'])->assertForbidden();
    $this->postJson('/api/facturacion/proveedores', ['nombre' => 'EOLO'])->assertForbidden();
});

test('cada ruta de escritura de 1b lleva su subdepartamento', function () {
    $esperado = [
        'POST api/facturacion/clientes' => 'subdep:factClientes',
        'PUT api/facturacion/clientes/{id}' => 'subdep:factClientes',
        'PATCH api/facturacion/clientes/{id}/desactivar' => 'subdep:factClientes',
        'PATCH api/facturacion/clientes/{id}/reactivar' => 'subdep:factClientes',
        'POST api/facturacion/servicios' => 'subdep:factServicios',
        'PUT api/facturacion/servicios/{id}' => 'subdep:factServicios',
        'PATCH api/facturacion/servicios/{id}/desactivar' => 'subdep:factServicios',
        'PATCH api/facturacion/servicios/{id}/reactivar' => 'subdep:factServicios',
        'POST api/facturacion/categorias-servicio' => 'subdep:factServicios',
        'PUT api/facturacion/categorias-servicio/{id}' => 'subdep:factServicios',
        'PATCH api/facturacion/categorias-servicio/{id}/desactivar' => 'subdep:factServicios',
        'PATCH api/facturacion/categorias-servicio/{id}/reactivar' => 'subdep:factServicios',
        'POST api/facturacion/formas-pago' => 'subdep:factFormasPago',
        'PUT api/facturacion/formas-pago/{id}' => 'subdep:factFormasPago',
        'PATCH api/facturacion/formas-pago/{id}/desactivar' => 'subdep:factFormasPago',
        'PATCH api/facturacion/formas-pago/{id}/reactivar' => 'subdep:factFormasPago',
        'POST api/facturacion/proveedores' => 'subdep:factProveedores',
        'PUT api/facturacion/proveedores/{id}' => 'subdep:factProveedores',
        'PATCH api/facturacion/proveedores/{id}/desactivar' => 'subdep:factProveedores',
        'PATCH api/facturacion/proveedores/{id}/reactivar' => 'subdep:factProveedores',
    ];

    $real = [];

    foreach (app('router')->getRoutes() as $ruta) {
        if (! str_starts_with($ruta->uri(), 'api/facturacion/')) {
            continue;
        }

        foreach (array_diff($ruta->methods(), ['GET', 'HEAD']) as $metodo) {
            $llave = "{$metodo} {$ruta->uri()}";

            if (! isset($esperado[$llave])) {
                continue; // rutas del bloque 1a, cubiertas por su propia prueba
            }

            $subdep = collect($ruta->gatherMiddleware())->first(fn ($m) => is_string($m) && str_starts_with($m, 'subdep:'));
            $real[$llave] = $subdep;
        }
    }

    expect($real)->toEqual($esperado);
});

test('el seeder crea los cuatro subdepartamentos nuevos', function () {
    $this->seed(Database\Seeders\FacturacionSubdepartamentosSeeder::class);

    $nombres = App\Models\Departamento::where('nombre', 'Facturacion')
        ->first()->subdepartamentos->pluck('nombre')->sort()->values()->all();

    expect($nombres)->toContain('factClientes', 'factServicios', 'factFormasPago', 'factProveedores');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/EndpointsCatalogos1bTest.php`
Expected: FAIL con 404 en todas las rutas

- [ ] **Step 3: Write the controllers and Form Requests**

Cada controlador replica el patrón de `app/Http/Controllers/Api/Facturacion/CategoriaAeronaveController.php`, que ya está en la rama: `index`, `store`, `update`, `desactivar` y `reactivar`, con las bajas atómicas y la bitácora. Léelo antes de escribir y sigue su forma.

Los códigos de error de los 409 son `ya_desactivado` / `ya_activo` para clientes, servicios y proveedores (masculino), y `ya_desactivada` / `ya_activa` para categorías de servicio y formas de pago (femenino).

Reglas de validación por catálogo:

```php
// StoreClienteRequest
'nombre' => ['required', 'string', 'max:160'],
'rfc' => ['nullable', 'string', 'max:20'],       // sin unique: se repite de forma legítima
'correo' => ['nullable', 'email', 'max:120'],
'telefono' => ['nullable', 'string', 'max:20'],

// StoreServicioRequest
'categoria_servicio_id' => ['nullable', 'integer', 'exists:fact_categorias_servicio,id'],
'nombre' => ['required', 'string', 'max:120'],
'precio_unitario' => ['required', 'numeric', 'min:0', 'decimal:0,4', 'max:99999999'],
'es_de_tercero' => ['required', 'boolean'],
'margen' => ['required', 'numeric', 'min:0', 'max:999.99', 'decimal:0,2'],
'ajuste_precio' => ['required', 'in:ninguno,mas_5,sin_iva,comision_131'],

// StoreCategoriaServicioRequest / StoreFormaPagoRequest / StoreProveedorRequest
'nombre' => ['required', 'string', 'max:80'],    // 60 en formas de pago, 120 en proveedores
```

**El `nombre` del cliente NO lleva `unique`**: los 195 del origen son únicos hoy, pero nada garantiza que dos clientes reales no se llamen igual.

- [ ] **Step 4: Register the routes**

En `routes/api.php`, dentro del grupo `prefix('facturacion')` que ya existe, agregar las lecturas y cinco grupos de escritura:

```php
    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::get('/servicios', [ServicioController::class, 'index']);
    Route::get('/categorias-servicio', [CategoriaServicioController::class, 'index']);
    Route::get('/formas-pago', [FormaPagoController::class, 'index']);
    Route::get('/proveedores', [ProveedorController::class, 'index']);

    Route::middleware('subdep:factClientes')->group(function () {
        Route::post('/clientes', [ClienteController::class, 'store']);
        Route::put('/clientes/{id}', [ClienteController::class, 'update'])->whereNumber('id');
        Route::patch('/clientes/{id}/desactivar', [ClienteController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/clientes/{id}/reactivar', [ClienteController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factServicios')->group(function () {
        Route::post('/servicios', [ServicioController::class, 'store']);
        Route::put('/servicios/{id}', [ServicioController::class, 'update'])->whereNumber('id');
        Route::patch('/servicios/{id}/desactivar', [ServicioController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/servicios/{id}/reactivar', [ServicioController::class, 'reactivar'])->whereNumber('id');
        Route::post('/categorias-servicio', [CategoriaServicioController::class, 'store']);
        Route::put('/categorias-servicio/{id}', [CategoriaServicioController::class, 'update'])->whereNumber('id');
        Route::patch('/categorias-servicio/{id}/desactivar', [CategoriaServicioController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/categorias-servicio/{id}/reactivar', [CategoriaServicioController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factFormasPago')->group(function () {
        Route::post('/formas-pago', [FormaPagoController::class, 'store']);
        Route::put('/formas-pago/{id}', [FormaPagoController::class, 'update'])->whereNumber('id');
        Route::patch('/formas-pago/{id}/desactivar', [FormaPagoController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/formas-pago/{id}/reactivar', [FormaPagoController::class, 'reactivar'])->whereNumber('id');
    });

    Route::middleware('subdep:factProveedores')->group(function () {
        Route::post('/proveedores', [ProveedorController::class, 'store']);
        Route::put('/proveedores/{id}', [ProveedorController::class, 'update'])->whereNumber('id');
        Route::patch('/proveedores/{id}/desactivar', [ProveedorController::class, 'desactivar'])->whereNumber('id');
        Route::patch('/proveedores/{id}/reactivar', [ProveedorController::class, 'reactivar'])->whereNumber('id');
    });
```

Agregar los cinco `use` de los controladores al principio del archivo; sin ellos el archivo de rutas no arranca.

Las categorías de servicio van bajo `factServicios` a propósito: son una clasificación de los servicios y se administran desde la misma pantalla, no tienen una propia.

En `routes/web.php`, dentro del grupo autenticado:

```php
    Route::get('facturacion/clientes', fn () => Inertia::render('Facturacion/Clientes'))->name('facturacionClientes');
    Route::get('facturacion/servicios', fn () => Inertia::render('Facturacion/Servicios'))->name('facturacionServicios');
    Route::get('facturacion/formas-pago', fn () => Inertia::render('Facturacion/FormasPago'))->name('facturacionFormasPago');
    Route::get('facturacion/proveedores', fn () => Inertia::render('Facturacion/Proveedores'))->name('facturacionProveedores');
```

- [ ] **Step 5: Extend the seeder**

En `database/seeders/FacturacionSubdepartamentosSeeder.php`, agregar los cuatro nombres nuevos al arreglo que ya recorre:

```php
        foreach ([
            'factAeronaves', 'factCategoriasAeronave', 'factTiposMotor', 'factCombustible',
            'factClientes', 'factServicios', 'factFormasPago', 'factProveedores',
        ] as $nombre) {
```

- [ ] **Step 6: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/EndpointsCatalogos1bTest.php`
Expected: PASS, 11 pruebas

- [ ] **Step 7: Run the full suite**

Run: `php artisan test`
Expected: PASS, 419 pruebas. La prueba del bloque 1a que recorre las rutas de escritura debe seguir en verde: solo revisa las suyas.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Api/Facturacion/ app/Http/Requests/Facturacion/ database/seeders/FacturacionSubdepartamentosSeeder.php routes/api.php routes/web.php tests/Feature/Facturacion/EndpointsCatalogos1bTest.php
git commit -m "Endpoints, permisos y bitacora de los catalogos de facturacion"
```

---

### Task 6: Las cuatro pantallas

**Files:**
- Modify: `resources/js/stores/apiFacturacionCatalogos.ts`
- Create: `resources/js/pages/Facturacion/Clientes.tsx`
- Create: `resources/js/pages/Facturacion/Servicios.tsx`
- Create: `resources/js/pages/Facturacion/FormasPago.tsx`
- Create: `resources/js/pages/Facturacion/Proveedores.tsx`
- Create: `resources/js/pages/Facturacion/components/ModalCliente.tsx`
- Create: `resources/js/pages/Facturacion/components/ModalServicio.tsx`

**Interfaces:**
- Consumes: los endpoints de la Task 5
- Produces: tipos `Cliente`, `Servicio`, `CategoriaServicio`, `FormaPago`, `Proveedor` y sus funciones de acceso en el store

- [ ] **Step 1: Reuse what the block 1a already built**

`FormasPago.tsx` y `Proveedores.tsx` son catálogos de nombre suelto, iguales en forma a `TiposMotor.tsx`. Configúralos con el componente `PantallaCatalogo` que ya existe en `resources/js/pages/Facturacion/components/PantallaCatalogo.tsx`, igual que hacen `CategoriasAeronave.tsx` (31 líneas) y `TiposMotor.tsx` (24). **No dupliques su lógica de baja, reactivación ni recuperación del nombre repetido.**

- [ ] **Step 2: Build the clients screen**

`Clientes.tsx` es el catálogo más grande (195 filas). Necesita buscador por nombre y por RFC, y paginación del servidor, a diferencia de los demás. Sigue la forma de `AeronavesFacturacion.tsx`, que ya resuelve buscador con debounce, descarte de respuestas viejas y corrección de página fuera de rango.

`ModalCliente.tsx` captura nombre, RFC, correo y teléfono. **El RFC repetido no es un error**: si el usuario captura uno que ya existe, el servidor lo acepta. No pongas validación de unicidad en el cliente ni avisos que sugieran que es un problema.

- [ ] **Step 3: Build the services screen**

`Servicios.tsx` con filtro por categoría y por "de tercero". `ModalServicio.tsx` captura categoría, nombre, precio, si es de tercero, margen y ajuste.

Dos reglas que la pantalla debe hacer evidentes:
- **El precio cero es válido.** Usa el componente `CampoMonto` que ya existe, que es `type="text"` a propósito para que `""` y `"0"` no se confundan.
- **El margen y el ajuste cambian lo que se cobra.** Muestra el importe resultante de una unidad al lado de los campos, para que quien captura vea el efecto: con precio 1000, tercero y margen 50, el importe es 1500.

Las categorías de servicio se administran desde un modal de esta misma pantalla, no desde una propia: son una clasificación de los servicios.

- [ ] **Step 4: Verify types, lint and build**

Run: `npx tsc --noEmit`
Expected: solo el error preexistente de `resources/js/actions/App/Http/Controllers/Api/WalkAroundController.ts(905,5)`

Run: `npx eslint resources/js/pages/Facturacion resources/js/stores/apiFacturacionCatalogos.ts`
Expected: sin errores ni advertencias

Run: `npm run build`
Expected: `built in …` sin errores

Run: `php artisan test`
Expected: PASS, 419 pruebas (el frontend no agrega pruebas de PHP)

- [ ] **Step 5: Commit**

```bash
git add resources/js/stores/apiFacturacionCatalogos.ts resources/js/pages/Facturacion/
git commit -m "Pantallas de clientes, servicios, formas de pago y proveedores"
```

---

### Task 7: Menú y sincronización del precio de combustible

Cierra el bloque con las entradas de menú y con el acoplamiento que los datos reales revelaron entre el servicio de combustible y su precio.

**Files:**
- Modify: `resources/js/components/navigation.ts`
- Modify: `app/Models/FactPrecioCombustible.php`
- Test: `tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php`

**Interfaces:**
- Consumes: `FactServicio` de la Task 3, `FactPrecioCombustible` del bloque 1a
- Produces: nada que otras tasks consuman

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php

use App\Models\FactPrecioCombustible;
use App\Models\FactServicio;
use App\Models\User;

/*
 * `actualizar_combustible.php` del sistema viejo no solo actualiza el precio:
 * también sincroniza el precio del servicio de combustible con el precio Eolo
 * recién calculado. Sin esto, el combustible se seguiría cobrando al precio
 * viejo aunque la pantalla mostrara el nuevo.
 */

test('registrar un precio nuevo actualiza el servicio de combustible', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    // (22.1643 + 0.50) * 1.15 = 26.0639
    expect((float) $servicio->fresh()->precio_unitario)->toBe(26.0639);
});

test('el servicio sigue el precio Eolo sobrescrito, no el calculado', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create(['nombre' => 'Combustible JET A-1', 'precio_unitario' => 0]);

    FactPrecioCombustible::registrar(22.1643, 30.0000, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(30.0000);
});

test('sin el servicio de combustible, registrar un precio no revienta', function () {
    $usuario = User::factory()->create();

    $precio = FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect($precio->id)->toBeInt()
        ->and(FactServicio::count())->toBe(0);
});

test('un servicio de combustible dado de baja no se toca', function () {
    $usuario = User::factory()->create();
    $servicio = FactServicio::create([
        'nombre' => 'Combustible JET A-1',
        'precio_unitario' => 21.6122,
        'status' => 'N',
    ]);

    FactPrecioCombustible::registrar(22.1643, null, $usuario->id);

    expect((float) $servicio->fresh()->precio_unitario)->toBe(21.6122);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php`
Expected: FAIL — el servicio conserva 21.6122 porque nada lo sincroniza.

- [ ] **Step 3: Sync the service price**

En `app/Models/FactPrecioCombustible.php`, dentro de la transacción de `registrar()` y después de crear la fila, agregar:

```php
            // El sistema viejo sincroniza el precio del servicio de combustible
            // con el precio Eolo (`actualizar_combustible.php`). Sin esto, el
            // combustible se cobraría al precio anterior.
            FactServicio::query()
                ->where('nombre', self::SERVICIO_COMBUSTIBLE)
                ->where('status', FactServicio::STATUS_ACTIVO)
                ->update(['precio_unitario' => $precio->precio_eolo]);
```

Y la constante al principio de la clase:

```php
    /** Nombre del servicio cuyo precio sigue al precio Eolo del combustible. */
    public const SERVICIO_COMBUSTIBLE = 'Combustible JET A-1';
```

Agregar el `use App\Models\FactServicio;` correspondiente.

- [ ] **Step 4: Run the tests**

Run: `php artisan test tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php`
Expected: PASS, 4 pruebas

- [ ] **Step 5: Add the menu entries**

En `resources/js/components/navigation.ts`, importar las cuatro rutas nuevas de `@/routes` y agregarlas a `ROUTE_CONFIG` con la llave en minúsculas y sin separadores, que es lo que produce `Str::slug` del nombre del subdepartamento:

```ts
    factclientes: {
        href: facturacionClientes,
        title: 'Clientes',
    },
    factservicios: {
        href: facturacionServicios,
        title: 'Servicios',
    },
    factformaspago: {
        href: facturacionFormasPago,
        title: 'Formas de pago',
    },
    factproveedores: {
        href: facturacionProveedores,
        title: 'Proveedores',
    },
```

Agregar `factservicios`, `factformaspago` y `factproveedores` al arreglo que agrupa bajo el nodo **Catálogos** —el que ya contiene `factcategoriasaeronave`, `facttiposmotor` y `factcombustible`—, y dejar `factclientes` en el primer nivel, junto a Aeronaves facturables, porque es de uso diario.

En la rama de administrador de `getNavModules`, agregar las cuatro entradas al módulo `Facturacion` que ya existe, con la misma agrupación.

- [ ] **Step 6: Verify everything**

Run: `php artisan test`
Expected: PASS, 423 pruebas

Run: `npx tsc --noEmit && npx eslint resources/js/components/navigation.ts && npm run build`
Expected: sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add app/Models/FactPrecioCombustible.php resources/js/components/navigation.ts tests/Feature/Facturacion/SincronizaPrecioCombustibleTest.php
git commit -m "Menu de los catalogos 1b y sincronizacion del precio de combustible"
```

---

## Orden de despliegue

Este bloque no toca nada existente ni tiene migraciones peligrosas: todas crean tablas nuevas.

```bash
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate

# El importador ahora trae también los catálogos de 1b. Si ya se corrió para
# las matrículas, hay que volver a correrlo con --forzar, porque fact_aeronaves
# tendrá filas. Es idempotente: las matrículas no se duplican.
php artisan facturacion:importar-matriculas            # simulación, revisar el reporte
php artisan facturacion:importar-matriculas --aplicar --forzar

php artisan db:seed --class=FacturacionSubdepartamentosSeeder
php artisan optimize:clear
npm ci && npm run build
```

Después, asignar los cuatro subdepartamentos nuevos (`factClientes`, `factServicios`, `factFormasPago`, `factProveedores`) desde Gestión de usuarios.

**Backend y frontend se despliegan juntos**, igual que en el bloque 1a.
