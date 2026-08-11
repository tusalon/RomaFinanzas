const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('la navegación principal usa acciones fáciles de entender', () => {
    const bottomNav = read('components/BottomNav.js');
    const topBar = read('components/TopBar.js');

    ['Inicio', 'Cobrar', 'Gasto', 'Más'].forEach((label) => assert.match(bottomNav, new RegExp(`label: '${label}'`)));
    assert.match(topBar, /income: 'Anotar un cobro'/);
    assert.match(topBar, /costSheet: 'Calcula cuánto te queda'/);
});

test('el menú muestra un camino guiado y las acciones diarias', () => {
    const menu = read('views/Menu.js');

    assert.match(menu, /Siguiente paso/);
    assert.match(menu, /Crea tus servicios/);
    assert.match(menu, /Añade lo que usas/);
    assert.match(menu, /Calcula cuánto te queda/);
    assert.match(menu, /Anotar cobro/);
    assert.match(menu, /Anotar gasto/);
});

test('los formularios esconden datos opcionales sin perderlos', () => {
    const income = read('views/Income.js');
    const materials = read('views/Materials.js');
    const costSheet = read('views/CostSheet.js');

    assert.match(income, /<details className="simple-details"/);
    assert.match(income, /Añadir cliente o una nota \(opcional\)/);
    assert.match(income, /Guardar cobro/);
    assert.match(materials, /Controlar cuántos quedan \(opcional\)/);
    assert.match(costSheet, /Otros costos \(opcional\)/);
    assert.match(costSheet, /3\. Esto te queda limpio/);
});

test('un producto guardado se puede añadir al cálculo con un toque', () => {
    const costSheet = read('views/CostSheet.js');

    assert.match(costSheet, /toggleSavedMaterial/);
    assert.match(costSheet, /Toca los productos que usas en este servicio/);
    assert.match(costSheet, /por cita/);
});

test('las opciones menos usadas permanecen fuera del camino principal', () => {
    const reports = read('views/Reports.js');
    const materials = read('views/Materials.js');
    const services = read('views/Services.js');

    assert.match(reports, /Ver cómo se calculó/);
    assert.match(reports, /Ver servicios que más dejan/);
    assert.match(materials, /Controlar cuántos quedan \(opcional\)/);
    assert.match(services, /Eliminar este servicio/);
});

test('el sistema visual profesional se aplica a toda la PWA', () => {
    const styles = read('styles/input.css');
    const topBar = read('components/TopBar.js');
    const bottomNav = read('components/BottomNav.js');
    const login = read('views/Login.js');
    const dashboard = read('views/Dashboard.js');

    assert.match(styles, /--plum: #2f1727/);
    assert.match(styles, /\.app-topbar/);
    assert.match(styles, /\.bottom-nav-inner/);
    assert.match(styles, /\.profit-hero/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(topBar, /topbar-eyebrow/);
    assert.match(bottomNav, /bottom-nav-item/);
    assert.equal(bottomNav.includes('animate-bounce'), false);
    assert.match(login, /login-card/);
    assert.match(dashboard, /metric-card--income/);
});
