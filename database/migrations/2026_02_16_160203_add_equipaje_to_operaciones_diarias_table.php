<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->integer('equipaje')->nullable()->after('departamento');
            $table->text('observaciones')->nullable()->after('equipaje');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('operaciones_diarias', function (Blueprint $table) {
            $table->dropColumn(['equipaje','observaciones']);
        });
    }
};
