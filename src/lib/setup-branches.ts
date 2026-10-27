// Sucursales de Ópticas Losada según el listado de Gesvision (serie → código GV<serie>).
// El importador las reconoce por ese código. Horarios por defecto: se ajustan en Configuración → Sucursales.
export const GESVISION_BRANCHES = [
  { code: "GV1006", name: "Comunal Las Condes", comuna: "Las Condes", region: "Metropolitana de Santiago", active: true },
  { code: "GV1003", name: "Comunal Vitacura", comuna: "Vitacura", region: "Metropolitana de Santiago", active: true },
  { code: "GV7", name: "Comunal Ñuñoa", comuna: "Ñuñoa", region: "Metropolitana de Santiago", active: true },
  { code: "GV1004", name: "Móvil 01 Las Condes", comuna: "Las Condes", region: "Metropolitana de Santiago", active: true },
  { code: "GV1", name: "Ópticas Losada Valparaíso", comuna: "Valparaíso", region: "Valparaíso", active: true },
  { code: "GV3", name: "Óptica Losada Concón", comuna: "Concón", region: "Valparaíso", active: true },
  { code: "GV1005", name: "Comunal Concón", comuna: "Concón", region: "Valparaíso", active: true },
  { code: "GV6", name: "Comunal Zapallar", comuna: "Zapallar", region: "Valparaíso", active: true },
  { code: "GV8", name: "Comunal Parral", comuna: "Parral", region: "Maule", active: true },
  { code: "GV1001", name: "Empresas", comuna: null, region: null, active: true },
  { code: "GV1002", name: "Empresas 2", comuna: null, region: null, active: true },
  { code: "GV5", name: "Antiguo Colina", comuna: "Colina", region: "Metropolitana de Santiago", active: false },
] as const;
