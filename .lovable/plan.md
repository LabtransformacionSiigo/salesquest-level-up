## Auditoría end-to-end: por qué nadie ha ganado SP Canje

### Hallazgos (lo que encontré en la base de datos y código)

**1. Catálogos de medallas están VACÍOS** (causa #1)
- `catalogo_medallas` (VC): **0 filas**.
- `medallas_vn_config` (VN): **0 filas**.
- Aunque en la UI parezca que cargaste medallas, no hay ni una sola en BD. Por eso `medallas` y `medallas_vn_ganadas` también están en 0.

**2. La función `evaluate-medals` está declarada pero NO EXISTE**
- `supabase/config.toml` la lista con `verify_jwt = false`, pero la carpeta `supabase/functions/evaluate-medals/` no existe.
- Resultado: no hay ningún proceso que otorgue medallas VC, ni siquiera si el catálogo tuviera registros.

**3. No hay cron que evalúe retos ni medallas**
- `evaluar-retos-vc` y `evaluar-retos-vn` solo se disparan con el botón "▶ Ejecutar Evaluación Ahora".
- No están en `pg_cron`. Hoy depende de que un humano pulse el botón.

**4. La evaluación VC no encuentra cumplimientos hoy** (causa #2)
- Hoy en el sistema es **2026-05-20**, pero la última `fecha_facturacion` en `ventas` VC es **2026-05-01**.
- Retos DIARIO buscan `fecha = today` → 0 ventas hoy → 0 retos diarios.
- Retos SEMANAL buscan ventas en la semana ISO actual → 0 → 0 retos semanales.
- Retos MENSUAL para Mayo: existen 410 filas SUM- y 936 PROD- con ACV de mayo, pero los umbrales son altos (ej. "La bota de oro" exige 120% de cumplimiento; "Contraataque" 33 nubes). Eso explica el resultado "Retos otorgados: 0" que viste al pulsar el botón.

**5. Solo VN_ALIADOS tiene retos VN — VN_EMPRESARIOS no tiene ninguno**
- `catalogo_retos` para VN solo tiene 3 registros, todos con `canal='VN_ALIADOS'`. Empresarios nunca podrá ganar SP Canje por retos.

**6. SP Canje total = 0 en toda la plataforma**
- `gerentes.sp_canje` y `asesores.sp_canje` ambos suman 0.
- `sp_acumulados` tiene 258 filas pero TODAS con `fuente='CUMPLIMIENTO_META'` y `tipo_sp` distinto de `'canje'`. Cero filas tipo canje → cero canjeables.

---

### Plan de corrección

**Paso 1 — Crear la función `evaluate-medals` (faltante)**
- Carpeta `supabase/functions/evaluate-medals/index.ts` que recorra `catalogo_medallas` activas, valide condiciones (primera_venta, cantidad_producto, evento, etc.) contra `ventas` y registre en `medallas` + `sp_acumulados (tipo_sp='canje')` + `gerentes.sp_canje` vía `otorgar_medalla_si_aplica` (RPC ya existente).
- Análogo para `medallas_vn_config` → `medallas_vn_ganadas`.

**Paso 2 — Centralizar la evaluación en un único orquestador**
- Crear `evaluar-gamificacion-todo` que invoque en orden: `evaluar-retos-vc`, `evaluar-retos-vn`, `evaluate-medals`. Una sola fuente de verdad para "evaluar ahora".
- Reemplazar el botón de la UI por la llamada al orquestador.

**Paso 3 — Cron cada 30 min**
- `pg_cron` invocando `evaluar-gamificacion-todo` cada 30 minutos para que SP Canje y medallas se actualicen sin intervención manual.

**Paso 4 — Habilitar VN_EMPRESARIOS en el catálogo**
- Duplicar los retos VN_ALIADOS para `canal='VN_EMPRESARIOS'` (o permitir `canal IN ('VN_ALIADOS','VN_EMPRESARIOS')`) para que también puedan ganar SP Canje.

**Paso 5 — Diagnóstico claro en la respuesta del botón**
- Que el endpoint devuelva por cada reto: gerentes evaluados, valor_alcanzado vs umbral, cuántos cumplieron, cuántos se saltaron por idempotencia. Hoy solo dice "0 · 0" y no se entiende por qué.

**Paso 6 — Sembrado de medallas mínimas (opcional, lo coordino contigo)**
- Si confirmas que en Admin > Medallas no aparece ninguna fila, hay que volver a cargarlas (parece que el guardado quedó en frontend pero no llegó a BD).

---

### Pregunta antes de implementar
- ¿Cuando entraste a **Admin > Medallas** veías filas listadas? Necesito confirmar si hubo un bug de guardado (UI muestra pero no persiste) o si nunca se guardaron. Si me confirmas eso, en la implementación incluyo también el fix del guardado de medallas.