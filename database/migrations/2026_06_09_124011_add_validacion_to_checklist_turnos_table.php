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
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->foreignId('validado_por_user_id')
                  ->nullable()
                  ->after('status')
                  ->constrained('users')
                  ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('checklist_turnos', function (Blueprint $table) {
            $table->dropForeign(['validado_por_user_id']);
            $table->dropColumn('validado_por_user_id');
        });
    }
};
