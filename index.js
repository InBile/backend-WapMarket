/* --- Layout minimalista --- */
.main-layout {
  display: flex;
  gap: 2rem;
  max-width: 1400px;
  margin: 2rem auto 1rem auto;
  padding: 0 1.5rem;
}
.sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.businesses, .filters {
  background: #fff;
  padding: 1.25rem 1rem 1.5rem 1rem;
  box-shadow: none;
  border-radius: 0;
  border: 1px solid #e5e7eb;
}
.businesses h3, .filters h3 {
  margin-top: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #222;
  display: flex;
  align-items: center;
  gap: .5rem;
}
.business-search {
  display: flex;
  gap: .5rem;
  margin: .75rem 0 1rem 0;
}
.business-search input {
  flex: 1;
  padding: .5rem .7rem;
  border-radius: 0;
  border: 1px solid #d1d5db;
}
.business-list {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
.business-item {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem .25rem;
  border-radius: 0;
  background: none;
  border-bottom: 1px solid #f3f4f6;
}
.business-item img {
  width: 32px; height: 32px; border-radius: 0; background: #eee;
}
.business-name { font-weight: 600; }
.business-category { font-size: .85rem; color: #888; }
.info-btn {
  display: none;
}
.filters label {
  margin-bottom: .7rem;
}
.filters input, .filters select {
  margin-top: .2rem;
  border-radius: 0;
}

/* --- Área de productos minimalista --- */
.products-area {
  flex: 1;
  min-width: 0;
}
.products-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}
.products-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}
.view-modes { display: none; }
.products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.2rem;
}
.product-card {
  background: none;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  transition: none;
}
.product-card img {
  width: 100%;
  max-width: 220px;
  height: 160px;
  object-fit: contain;
  border-radius: 0;
  background: #f3f4f6;
  margin-bottom: .5rem;
}
.product-info {
  width: 100%;
  text-align: left;
  margin-top: 0;
}
.product-title {
  font-weight: 600;
  font-size: 1.05rem;
  margin-bottom: .2rem;
}
.product-price {
  color: #131921;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: .3rem;
}
.product-btn {
  width: auto;
  padding: .4rem 1.1rem;
  border: none;
  border-radius: 0;
  background: #f59e0b;
  color: #131921;
  font-weight: 600;
  font-size: .98rem;
  margin-top: .2rem;
  transition: none;
}
.product-btn:hover {
  background: #131921;
  color: #fff;
}

@media (max-width: 1100px) {
  .main-layout { flex-direction: column; gap: 1.5rem; }
  .sidebar { width: 100%; flex-direction: row; gap: 1.5rem; }
  .businesses, .filters { flex: 1; }
}
@media (max-width: 700px) {
  .main-layout { padding: 0 .3rem; }
  .sidebar { flex-direction: column; gap: 1rem; }
  .products-list { grid-template-columns: 1fr; }
  .product-card img { width: 100%; height: 120px; }
}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;color:#111}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:1rem;padding:.75rem 1rem;background:#131921;color:#fff}
.brand{font-weight:700;font-size:1.2rem}
.search{flex:1;display:flex;gap:.5rem}
.search input{flex:1;padding:.5rem .75rem;border-radius:.5rem;border:1px solid #333;background:#1f2937;color:#fff}
.search button{padding:.55rem .9rem;border-radius:.5rem;border:none;background:#f59e0b;color:#111;font-weight:600;cursor:pointer}
.nav{display:flex;gap:1rem;align-items:center}
.nav a,.nav button{color:#fff;text-decoration:none;background:transparent;border:none;cursor:pointer}
.container{max-width:1100px;margin:1rem auto;padding:0 1rem}
.store-section{margin-bottom:1.5rem}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem}
.section-header h3{margin:0}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
.card{background:#fff;border-radius:.75rem;box-shadow:0 4px 12px rgba(0,0,0,.06);padding:1rem}
.product img{width:100%;height:160px;object-fit:cover;border-radius:.5rem;background:#eee}
.product .title{font-weight:600;margin-top:.5rem}
.product .price{color:#16a34a;font-weight:700;margin:.25rem 0}
.product button{width:100%;padding:.5rem;border:none;border-radius:.5rem;background:#111;color:#fff;cursor:pointer}
.footer{padding:2rem;text-align:center;color:#555}
.drawer{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;justify-content:flex-end}
.drawer.hidden{display:none}
.drawer-content{width:420px;max-width:100%;height:100%;background:#fff;padding:1rem;display:flex;flex-direction:column}
.drawer-header{display:flex;align-items:center;justify-content:space-between}
.drawer-footer{margin-top:auto}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.modal.hidden{display:none}
.modal-content{width:640px;max-width:95%;background:#fff;border-radius:.75rem;padding:1rem}
.modal-header{display:flex;align-items:center;justify-content:space-between}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}
.summary{background:#f3f4f6;padding:.75rem;border-radius:.5rem;margin:.75rem 0}
.total{font-size:1.1rem}
.auth{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
label{display:flex;flex-direction:column;gap:.35rem;font-size:.9rem}
input,select,textarea{padding:.55rem .7rem;border:1px solid #d1d5db;border-radius:.5rem;background:#fff}
button{cursor:pointer}
table{width:100%;border-collapse:collapse}
th,td{padding:.5rem;border-bottom:1px solid #e5e7eb;text-align:left}
@media(max-width:900px){
  .grid-4{grid-template-columns:repeat(2,1fr)}
  .auth{grid-template-columns:1fr}
  .grid{grid-template-columns:1fr}
}
/* ======= Icon Buttons / Badge / Util ======= */
.icon-btn{
  position: relative;
  display: grid;
  place-items: center;
  width: 40px; height: 40px;
  border: none; border-radius: 10px;
  background: transparent; color: #fff;
  transition: background .2s ease, transform .1s ease;
}
.icon-btn:hover{ background: rgba(255,255,255,.12); }
.icon-btn:active{ transform: scale(.96); }
.icon-btn.sm{ width: 34px; height: 34px; border-radius: 8px; color: #111; background: #f3f4f6; }
.icon-btn.sm:hover{ background: #e5e7eb; }

.badge{
  position: absolute; top: -4px; right: -4px;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px;
  background: #f59e0b; color: #111; font-weight: 700;
  font-size: 12px; display: grid; place-items: center;
}

/* ======= Paneles retractiles (details) ======= */
.panel{
  border: 1px solid #e5e7eb; border-radius: 12px;
  background: #fff; overflow: hidden;
}
.panel + .panel{ margin-top: 1rem; }
.panel-summary{
  list-style: none; cursor: pointer; user-select: none;
  display: flex; align-items: center; justify-content: space-between;
  gap: .75rem; padding: .9rem 1rem; font-weight: 700; color: #111;
}
.panel summary::-webkit-details-marker{ display: none; }
.panel .chev{
  width: 10px; height: 10px; border: 2px solid #111;
  border-left: 0; border-top: 0; transform: rotate(45deg);
  transition: transform .2s ease;
}
.panel .chev.open{ transform: rotate(225deg); }
.panel[open] .chev{ transform: rotate(225deg); }
.panel > .businesses, .panel > .filters{ padding: .75rem 1rem 1rem 1rem; }

/* ======= Buscador y chip "Todos" ======= */
.business-actions{ display: flex; flex-direction: column; gap: .5rem; }
.business-search{ display: flex; gap: .5rem; }
.business-search input{
  flex: 1; padding: .55rem .7rem; border-radius: 10px;
  border: 1px solid #d1d5db; background: #fff;
}
.chip{
  padding: .5rem .85rem; border-radius: 999px; border: 1px solid #e5e7eb;
  background: #f8fafc; color: #111; font-weight: 600; cursor: pointer;
}
.chip:hover{ background: #eef2ff; border-color: #c7d2fe; }

/* ======= Lista de negocios moderna ======= */
.business-list{ display: flex; flex-direction: column; gap: .6rem; margin-top: .5rem; }
.business-item{
  display: grid; grid-template-columns: 40px 1fr auto; align-items: center;
  gap: .75rem; padding: .6rem .65rem; border: 1px solid #eef2f7;
  border-radius: 12px; background: #fff;
  transition: border-color .2s ease, box-shadow .2s ease, transform .04s ease;
}
.business-item:hover{
  border-color: #e0e7ff; box-shadow: 0 4px 14px rgba(37,99,235,.08);
}
.business-item:active{ transform: scale(.995); }
.business-item img{ width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: #f3f4f6; }
.business-name{ font-weight: 700; color: #111; }
.business-meta{ font-size: .85rem; color: #6b7280; }
.biz-arrow{
  width: 12px; height: 12px; border: 2px solid #94a3b8; border-left: 0; border-top: 0; transform: rotate(-45deg);
}

/* ======= Filtros ======= */
.filters label{ display: flex; flex-direction: column; gap: .35rem; margin-bottom: .7rem; }
.filters input, .filters select{
  padding: .55rem .7rem; border: 1px solid #d1d5db; border-radius: 10px; background: #fff;
}

/* ======= Área de productos (de tu CSS base) ======= */
.products-header{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem; }
.products-list{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.2rem; }

/* Botón primario reutilizable */
.btn-primary{
  padding: .55rem .9rem; border-radius: .6rem; border: none;
  background: #111; color: #fff; font-weight: 700;
}
.btn-primary.wide{ width: 100%; }

/* ======= Topbar (mantiene tu esquema) ======= */
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:1rem;padding:.75rem 1rem;background:#131921;color:#fff}
.brand{font-weight:700;font-size:1.2rem}
.search{flex:1;display:flex;gap:.5rem}
.search input{flex:1;padding:.5rem .75rem;border-radius:.5rem;border:1px solid #333;background:#1f2937;color:#fff}
.search button{padding:.55rem .9rem;border-radius:.5rem;border:none;background:#f59e0b;color:#111;font-weight:600;cursor:pointer}
.nav{display:flex;gap:.5rem;align-items:center}

/* ======= Layout base (tomado y refinado) ======= */
.main-layout{display:flex;gap:2rem;max-width:1400px;margin:2rem auto 1rem;padding:0 1.5rem}
.sidebar{width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:1rem}
.products-area{flex:1;min-width:0}

/* ======= Drawer / Modal (ajustes mínimos) ======= */
.drawer{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;justify-content:flex-end}
.drawer.hidden{display:none}
.drawer-content{width:420px;max-width:100%;height:100%;background:#fff;padding:1rem;display:flex;flex-direction:column;border-top-left-radius:12px;border-bottom-left-radius:12px}
.drawer-header{display:flex;align-items:center;justify-content:space-between}
.drawer-footer{margin-top:auto}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.modal.hidden{display:none}
.modal-content{width:640px;max-width:95%;background:#fff;border-radius:.75rem;padding:1rem}
.modal-header{display:flex;align-items:center;justify-content:space-between}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}
.summary{background:#f3f4f6;padding:.75rem;border-radius:.5rem;margin:.75rem 0}
.total{font-size:1.1rem}

/* ======= Footer reducido ======= */
.footer{padding:1.2rem;text-align:center;color:#6b7280;font-size:.9rem}
.footer .legal-links{display:flex;gap:.8rem;justify-content:center;margin-top:.4rem}
.footer .legal-links a{color:#111;text-decoration:none}
.footer .legal-links a:hover{text-decoration:underline}

/* ======= Responsive ======= */
@media (max-width: 1100px){
  .main-layout{flex-direction:column;gap:1.2rem}
  .sidebar{width:100%;flex-direction:column}
}
@media (max-width: 700px){
  .main-layout{padding:0 .5rem}
  .products-list{grid-template-columns:1fr}
  .icon-btn{width:38px;height:38px}
  .search button{display:none} /* más limpio en móvil, usa Enter */
}
/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .main-layout {
    display: flex;
    flex-direction: column;
  }

  /* Sidebar se colapsa */
  .sidebar {
    order: 2;
    width: 100%;
    border-top: 1px solid #ddd;
    padding: 0.5rem;
  }

  .products-area {
    order: 1;
    width: 100%;
  }

  /* Grid de productos en 2 columnas */
  .products-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  .products-header {
    text-align: center;
  }

  /* Topbar compacta */
  .topbar {
    flex-wrap: wrap;
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .topbar .search {
    flex: 1 1 100%;
    display: flex;
    gap: 0.5rem;
  }

  .topbar input {
    flex: 1;
    font-size: 0.9rem;
  }

  .nav, #cartBtn {
    margin-left: auto;
  }

  /* Drawer ocupa toda la pantalla */
  .drawer-content {
    width: 100%;
    max-width: 100%;
    height: 100%;
    border-radius: 0;
  }

  /* Modal centrado y responsivo */
  .modal-content {
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
  }
}

@media (max-width: 500px) {
  /* Productos en 1 columna */
  .products-list {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .topbar .brand {
    text-align: center;
    width: 100%;
  }

  .topbar .search {
    flex-direction: column;
  }

  .topbar button {
    width: 100%;
  }
}
/* ==== Tarjetas de producto ==== */
.products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.product-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 0.5rem;
  text-align: center;
  position: relative;
  height: 220px; /* altura fija para cuadrado compacto */
}

.product-card img {
  max-height: 100px;
  object-fit: contain;
  margin: auto;
}

.product-card h3 {
  font-size: 0.9rem;
  margin: 0.5rem 0;
  flex: 0 0 auto;
}

.product-card p {
  font-size: 0.8rem;
  color: #666;
  flex: 0 0 auto;
}

/* Botón añadir centrado en la parte inferior */
.product-card .btn-add {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  padding: 0.4rem;
  font-size: 0.85rem;
  border-radius: 20px;
}

/* Responsivo para móviles */
@media (max-width: 700px) {
  .products-list {
    grid-template-columns: repeat(2, 1fr); /* siempre 2 columnas */
    gap: 0.7rem;
  }

  .product-card {
    height: 200px;
    padding-bottom: 2rem; /* espacio para botón */
  }
}

@media (max-width: 400px) {
  .products-list {
    grid-template-columns: 1fr; /* si es muy estrecho, 1 por fila */
  }
}
/* ==== Grilla de productos ==== */
.products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

/* Forzar mínimo 2 productos por fila en móviles */
@media (max-width: 500px) {
  .products-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ==== Tarjeta de producto ==== */
.product-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 0;          /* 👈 sin bordes redondeados */
  padding: 0.5rem;
  text-align: center;
  position: relative;
  height: 220px;             /* altura fija compacta */
}

.product-card img {
  max-height: 100px;
  object-fit: contain;
  margin: 0.5rem auto;
}

.product-card h3 {
  font-size: 0.9rem;
  margin: 0.3rem 0;
}

.product-card p {
  font-size: 0.8rem;
  color: #666;
  margin: 0.3rem 0;
}

/* Botón añadir centrado en el fondo */
.product-card .btn-add {
  position: absolute;
  bottom: 10px;            /* 👈 siempre en el fondo */
  left: 50%;               /* 👈 lo coloca en el centro */
  transform: translateX(-50%); /* 👈 ajuste fino */
  width: auto;             /* 👈 ancho según contenido */
  min-width: 100px;        /* 👈 mínimo para que se vea bien */
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  border-radius: 0;        /* 👈 sin bordes redondeados */
}

/* ==== Grilla de productos ==== */
.products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

/* Forzar mínimo 2 productos por fila en móviles */
@media (max-width: 500px) {
  .products-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ==== Tarjeta de producto ==== */
.product-card {
  display: flex;
  flex-direction: column;
  justify-content: center;   /* 👈 todo centrado verticalmente */
  align-items: center;       /* 👈 centrado horizontal */
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 0;          /* 👈 sin bordes redondeados */
  padding: 0.5rem;
  text-align: center;
  height: 220px;             /* altura fija compacta */
}

.product-card img {
  max-height: 100px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.product-card h3 {
  font-size: 0.9rem;
  margin: 0.3rem 0;
}

.product-card p {
  font-size: 0.8rem;
  color: #666;
  margin: 0.3rem 0;
}

/* Botón añadir centrado en el medio */
.product-card .btn-add {
  margin-top: 0.5rem;
  width: 70%;
  padding: 0.5rem;
  font-size: 0.9rem;
  border-radius: 0;
}
/* ==== Grilla de productos ==== */
.products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

/* Forzar mínimo 2 productos por fila en móviles */
@media (max-width: 500px) {
  .products-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ==== Tarjeta de producto ==== */
.product-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 0;         /* 👈 sin bordes redondeados */
  padding: 0.5rem;
  text-align: center;
  position: relative;
  height: 220px;            /* altura fija compacta */
}

.product-card img {
  max-height: 100px;
  object-fit: contain;
  margin: auto;
}

.product-card h3 {
  font-size: 0.9rem;
  margin: 0.5rem 0;
  flex: 0 0 auto;
}

.product-card p {
  font-size: 0.8rem;
  color: #666;
  flex: 0 0 auto;
}

/* Botón añadir fijo abajo y centrado */
.product-card .btn-add {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  padding: 0.4rem;
  font-size: 0.85rem;
  border-radius: 0;       /* 👈 sin bordes redondeados */
}
.modal {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}
.modal.hidden { display: none; }

.modal-content {
  background: #fff;
  padding: 1rem;
  max-width: 300px;
  width: 90%;
  border: 1px solid #ddd;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}


