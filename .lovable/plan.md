

# Rediseño completo de la plataforma - Estilo del mockup

## Resumen

Aplicar el diseño exacto del mockup proporcionado a toda la plataforma: sidebar lateral con iconos + texto debajo, header limpio sin fondo, barra de progreso horizontal con checkmarks, stats cards en fila, leaderboard con tabs en vez de dropdowns, y colores limpios sobre fondo blanco.

## Cambios principales

### 1. Sidebar (sidebar ligero con iconos + labels debajo)
- Cambiar de fondo oscuro a fondo blanco/claro con borde derecho sutil
- Mover el avatar del usuario al tope del sidebar
- Mostrar los items de navegacion como iconos centrados con label debajo (no horizontal)
- Iconos usando Material Icons Outlined en vez de Lucide
- Item activo resaltado con color primario (azul cyan)
- "Ajustes" al fondo del sidebar con icono de engranaje
- Quitar el boton de colapsar

### 2. Header (limpio, sin card)
- Quitar el fondo blanco tipo card y el borde inferior
- Mostrar fecha arriba en gris, saludo grande "Hola Jorge!" con emoji, "Miembro desde 2024" debajo
- Toggle "Este mes / A hoy" a la derecha como botones pill

### 3. Level Progress Road (barra horizontal continua)
- Reemplazar los cards individuales por una barra horizontal unica
- Niveles completados muestran checkmark verde circular
- Multiplicadores (1.0x, 1.5x, 2.5x) arriba de los niveles correspondientes
- Porcentaje debajo de cada nivel
- Una barra de progreso gradient (cyan a gris) corriendo horizontalmente

### 4. Stats Cards (5 en fila, layout limpio)
- 5 cards en una fila con borde sutil
- Numero grande + icono a la derecha
- Label debajo en gris
- Sub-info en texto pequeno verde/gris
- Card de "Asiento asegurado" con icono de avion y "CONVENCION 2025" + "Premium Economy" en verde

### 5. Mini Leaderboard (tabs en vez de dropdowns)
- Reemplazar los 3 Select dropdowns por tabs simples: "Pais | Segmento | Canal"
- Podium con avatares circulares mas grandes, borde dorado para #1
- Lista de posiciones 4-8 con avatar circular, nombre, cargo, y XP en verde a la derecha

### 6. Colores y estilos globales
- Asegurar que el fondo general sea blanco/gris muy claro (#F8FAFC)
- Cards con bordes sutiles, sin sombras pesadas
- XP values en color primario cyan
- Tipografia Plus Jakarta Sans confirmada

## Detalle tecnico

**Archivos a modificar:**
- `src/components/layout/Sidebar.tsx` - Redisenar completamente a layout vertical con iconos + labels
- `src/components/layout/Header.tsx` - Quitar card bg, layout limpio
- `src/components/layout/Layout.tsx` - Ajustar estructura flex
- `src/components/dashboard/LevelProgressRoad.tsx` - Barra horizontal con checkmarks
- `src/components/dashboard/StatsCards.tsx` - Layout 5 columnas limpio
- `src/components/dashboard/MiniLeaderboard.tsx` - Tabs en vez de dropdowns
- `src/components/dashboard/ExecutiveDashboard.tsx` - Ajustes de spacing
- `src/index.css` - Refinamientos de variables CSS si es necesario

