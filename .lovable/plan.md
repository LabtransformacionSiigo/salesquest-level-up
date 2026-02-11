

# Rediseno Visual Completo - Estilo Mockup de Referencia

El objetivo es transformar la plataforma para que se vea exactamente como el mockup de referencia que compartes: limpio, sofisticado, con fondo blanco/celeste suave, tarjetas con bordes redondeados y sombras sutiles, y una barra superior minimalista.

---

## Cambios Principales

### 1. Header (Barra Superior)
**Estado actual:** Barra con gradiente azul intenso, demasiado oscura y pesada.
**Nuevo diseno:** Barra blanca/clara con logo "Siigo Hero" a la izquierda, icono de modo oscuro al centro, y nombre del usuario + nivel + avatar a la derecha, tal como en el mockup. Fondo blanco con sombra sutil inferior.

### 2. Sidebar (Barra Lateral)
**Estado actual:** Sidebar oscuro navy de 72px.
**Correccion:** Se mantiene oscuro pero se refina para que sea mas consistente con el mockup - el sidebar no aparece en la referencia de Hero Journey, lo que sugiere que la pagina Hero Journey deberia ser full-width sin sidebar, o mantener el sidebar actual pero mas limpio.

### 3. HeroLevelBar (Tarjetas de Niveles)
**Estado actual:** Tarjetas con bordes de colores pero sin la descripcion de "Foco" que muestra el mockup.
**Nuevo diseno segun mockup:**
- Cada tarjeta con icono circular de color (no cuadrado)
- Nombre del nivel en negrita
- Subtitulo "NIVEL X" en gris
- Badge de rango de puntos con color especifico por nivel (sky, naranja, azul primario, morado, rojo)
- Texto "Foco:" con descripcion del enfoque estrategico
- La tarjeta activa (Tu Nivel) tiene borde azul primario y badge "TU NIVEL" encima
- Fondo completamente blanco con bordes suaves

### 4. Pagina Hero Journey / Profile
**Rediseno completo siguiendo el mockup:**

**Seccion 1 - Titulo Hero:**
- Titulo grande centrado: "La Ruta del Heroe Comercial" con gradiente azul
- Subtitulo descriptivo centrado
- Fondo blanco limpio

**Seccion 2 - Tarjetas de Niveles:**
- 5 tarjetas en fila con el diseno descrito arriba
- Incluir texto de "Foco:" en cada tarjeta

**Seccion 3 - Insignias y Medallas:**
- Card blanca con borde redondeado
- Header con icono de medalla + titulo + badges "Achiever" / "Killer"
- 4 insignias en fila: icono circular grande, nombre en bold, subtitulo de categoria en color (EFECTIVIDAD, VOLUMEN, COLABORACION, VALOR), descripcion debajo

**Seccion 4 - Tabla de Puntos + Objetivos Estrategicos (lado a lado):**
- Izquierda: Card blanca "Tabla de Puntos" con tabla simple ACCION | PUNTOS
- Derecha: Card azul primario con gradiente "Objetivos Estrategicos" con 3 items (Visibilidad en Tiempo Real, Productividad Sostenible, Maestria) y seccion "Impacto Proyectado"

**Footer:**
- Indicadores de paginacion (dots)
- Copyright centrado

### 5. Colores y Tokens CSS
- Asegurar que `--primary` (#00AAFF) se usa consistentemente
- Fondo de pagina mas blanco/limpio (reducir el tinte gris)
- Sombras mas suaves y sutiles
- Bordes de tarjetas mas delicados

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/index.css` | Ajustar background, sombras, agregar utilidades nuevas |
| `src/components/layout/Header.tsx` | Redisenar a fondo blanco limpio con el estilo del mockup |
| `src/components/layout/HeroLevelBar.tsx` | Agregar iconos circulares, texto "Foco:", diseno del mockup |
| `src/pages/HeroJourney.tsx` | Rediseno completo siguiendo el mockup exacto: titulo hero, niveles, insignias, tabla de puntos, objetivos estrategicos |
| `src/components/layout/Layout.tsx` | Posible ajuste de padding/background |

---

## Detalles Tecnicos

- Se usaran los mismos componentes de `@radix-ui` y `tailwindcss` existentes
- Los iconos se mantienen con `material-icons-outlined`
- Las tarjetas de nivel incluiran datos de "Foco" mapeados estaticamente (Aprendizaje, Consistencia, Cumplimiento, Mentoring, Liderazgo)
- La seccion de "Objetivos Estrategicos" usara fondo con gradiente del color primario
- Se mantiene la funcionalidad existente de niveles dinamicos desde ConfigContext

