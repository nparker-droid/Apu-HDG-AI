
import { ItemCategory, APU } from '../types';

export const STANDARD_LIBRARY: Partial<APU>[] = [
  // 1. INSTALACIÓN Y GENERALES
  {
    name: "Instalación de faenas y oficinas",
    unit: "Gl",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m1", description: "Materiales instalaciones temporales", unit: "gl", quantity: 1, unitPrice: 2500000, total: 2500000 }],
      [ItemCategory.MANO_DE_OBRA]: [
        { id: "mo1", description: "Maestro Civil", unit: "hr", quantity: 1, performance: 120, unitPrice: 8500, total: 1020000 },
        { id: "mo2", description: "Ayudante", unit: "hr", quantity: 1, performance: 180, unitPrice: 5500, total: 990000 }
      ],
      [ItemCategory.EQUIPO]: [{ id: "e1", description: "Herramientas menores", unit: "gl", quantity: 1, unitPrice: 150000, total: 150000 }],
      [ItemCategory.OTROS]: [
        { id: "o1", description: "Movilización de contenedores", unit: "gl", quantity: 1, unitPrice: 850000, total: 850000 },
        { id: "o2", description: "Baños químicos mensuales", unit: "mes", quantity: 4, unitPrice: 85000, total: 340000 }
      ]
    }
  },
  {
    name: "Cierro provisorio de faena (H=2.0m)",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m2", description: "Malla Bizcocho / Plancha OSB", unit: "m", quantity: 1.05, unitPrice: 8500, total: 8925 },
        { id: "m3", description: "Postes de madera 4x4", unit: "un", quantity: 0.4, unitPrice: 6500, total: 2600 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo3", description: "Jornal", unit: "hr", quantity: 1, performance: 0.5, unitPrice: 5200, total: 2600 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },

  // 2. MOVIMIENTO DE TIERRAS
  {
    name: "Excavación manual en terreno semiduro",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo4", description: "Jornal", unit: "hr", quantity: 1, performance: 4.5, unitPrice: 5200, total: 23400 }],
      [ItemCategory.EQUIPO]: [{ id: "e2", description: "Herramientas manuales (5% MO)", unit: "gl", quantity: 1, unitPrice: 1170, total: 1170 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Excavación mecánica con retroexcavadora",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo5", description: "Ayudante señalero", unit: "hr", quantity: 1, performance: 0.15, unitPrice: 5500, total: 825 }],
      [ItemCategory.EQUIPO]: [{ id: "e3", description: "Retroexcavadora", unit: "hm", quantity: 1, performance: 0.12, unitPrice: 35000, total: 4200 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Relleno estructural compactado",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m4", description: "Integral / Estructural", unit: "m3", quantity: 1.25, unitPrice: 14500, total: 18125 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo6", description: "Jornal", unit: "hr", quantity: 1, performance: 1.2, unitPrice: 5200, total: 6240 }],
      [ItemCategory.EQUIPO]: [{ id: "e4", description: "Placa compactadora", unit: "día", quantity: 1, performance: 0.15, unitPrice: 28000, total: 4200 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Transporte y botadero de excedentes",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [],
      [ItemCategory.MANO_DE_OBRA]: [],
      [ItemCategory.EQUIPO]: [{ id: "e5", description: "Camión tolva 15m3", unit: "viaje", quantity: 0.08, unitPrice: 95000, total: 7600 }],
      [ItemCategory.OTROS]: [{ id: "o3", description: "Derecho a botadero", unit: "m3", quantity: 1.2, unitPrice: 3500, total: 4200 }]
    }
  },

  // 3. OBRAS CIVILES / HORMIGONES
  {
    name: "Emplantillado de hormigón pobre H-5",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m5", description: "Hormigón H-5 premezclado", unit: "m3", quantity: 1.03, unitPrice: 75000, total: 77250 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo7", description: "Cuadrilla hormigón", unit: "hr", quantity: 1, performance: 2.5, unitPrice: 12000, total: 30000 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Hormigón de fundaciones H-25 (Bomba)",
    unit: "m3",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m6", description: "Hormigón H-25 R7 premezclado", unit: "m3", quantity: 1.05, unitPrice: 98000, total: 102900 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo8", description: "Cuadrilla hormigón", unit: "hr", quantity: 1, performance: 3.2, unitPrice: 12500, total: 40000 }],
      [ItemCategory.EQUIPO]: [{ id: "e6", description: "Sonda vibradora", unit: "día", quantity: 0.1, unitPrice: 15000, total: 1500 }],
      [ItemCategory.OTROS]: [{ id: "o4", description: "Servicio de bomba", unit: "m3", quantity: 1, unitPrice: 12000, total: 12000 }]
    }
  },
  {
    name: "Acero de refuerzo A630-420H",
    unit: "kg",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m7", description: "Fierro estriado", unit: "kg", quantity: 1.08, unitPrice: 1150, total: 1242 },
        { id: "m8", description: "Alambre de amarre #18", unit: "kg", quantity: 0.02, unitPrice: 2200, total: 44 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo9", description: "Enfierrador", unit: "hr", quantity: 1, performance: 0.08, unitPrice: 8800, total: 704 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Moldaje para muros y fundaciones",
    unit: "m2",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m9", description: "Pino cepillado/Placa", unit: "m2", quantity: 0.25, unitPrice: 15000, total: 3750 },
        { id: "m10", description: "Desmoldante", unit: "lt", quantity: 0.2, unitPrice: 4500, total: 900 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo10", description: "Carpintero moldaje", unit: "hr", quantity: 1, performance: 1.5, unitPrice: 8500, total: 12750 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },

  // 4. OBRAS HIDRÁULICAS / TUBERÍAS
  {
    name: "Tubería HDPE PE100 PN10 DN110",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m11", description: "Tubo HDPE PE100 PN10 110mm", unit: "m", quantity: 1.03, unitPrice: 12500, total: 12875 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo11", description: "Cuadrilla fusión", unit: "hr", quantity: 1, performance: 0.45, unitPrice: 15000, total: 6750 }],
      [ItemCategory.EQUIPO]: [{ id: "e7", description: "Termofusionadora hidráulica", unit: "día", quantity: 1, performance: 0.05, unitPrice: 45000, total: 2250 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Tubería PVC Sanitario Clase IV 110mm",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m12", description: "Tubo PVC 110mm", unit: "m", quantity: 1.05, unitPrice: 6500, total: 6825 },
        { id: "m13", description: "Lubricante y adhesivo", unit: "gl", quantity: 0.01, unitPrice: 25000, total: 250 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo12", description: "Gasfíter", unit: "hr", quantity: 1, performance: 0.35, unitPrice: 7500, total: 2625 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Tubería Acero Galvanizado 2\" Sch40",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m14", description: "Cañería Galv 2\"", unit: "m", quantity: 1.03, unitPrice: 22000, total: 22660 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo13", description: "Maestro cañerista", unit: "hr", quantity: 1, performance: 1.2, unitPrice: 9500, total: 11400 }],
      [ItemCategory.EQUIPO]: [{ id: "e8", description: "Roscadora eléctrica", unit: "día", quantity: 0.1, unitPrice: 35000, total: 3500 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Válvula de compuerta DN100 PN16",
    unit: "un",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m15", description: "Válvula compuerta elástica", unit: "un", quantity: 1, unitPrice: 245000, total: 245000 },
        { id: "m16", description: "Kit de pernos y empaquetadura", unit: "un", quantity: 2, unitPrice: 18000, total: 36000 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo14", description: "Maestro montajista", unit: "hr", quantity: 1, performance: 4, unitPrice: 9500, total: 38000 }],
      [ItemCategory.EQUIPO]: [{ id: "e9", description: "Camión pluma (apoyo)", unit: "hm", quantity: 0.5, unitPrice: 45000, total: 22500 }],
      [ItemCategory.OTROS]: []
    }
  },

  // 5. TERMINACIONES Y PAVIMENTOS
  {
    name: "Pavimento de asfalto e=5cm",
    unit: "m2",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m17", description: "Mezcla asfáltica en caliente", unit: "ton", quantity: 0.125, unitPrice: 85000, total: 10625 },
        { id: "m18", description: "Imprimación CRS-1", unit: "lt", quantity: 0.8, unitPrice: 1200, total: 960 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo15", description: "Cuadrilla asfalto", unit: "hr", quantity: 1, performance: 0.25, unitPrice: 25000, total: 6250 }],
      [ItemCategory.EQUIPO]: [{ id: "e10", description: "Rodillo doble tambor", unit: "hm", quantity: 0.15, unitPrice: 32000, total: 4800 }],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Solera tipo A con zarpa",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m19", description: "Solera tipo A", unit: "un", quantity: 1, unitPrice: 9500, total: 9500 },
        { id: "m20", description: "Hormigón respaldo H-20", unit: "m3", quantity: 0.08, unitPrice: 95000, total: 7600 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo16", description: "Maestro solerista", unit: "hr", quantity: 1, performance: 0.6, unitPrice: 8500, total: 5100 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Baldosa microvibrada 40x40",
    unit: "m2",
    items: {
      [ItemCategory.MATERIAL]: [
        { id: "m21", description: "Baldosa 40x40", unit: "m2", quantity: 1.05, unitPrice: 18500, total: 19425 },
        { id: "m22", description: "Mortero de pega", unit: "saco", quantity: 0.4, unitPrice: 5500, total: 2200 }
      ],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo17", description: "Maestro ceramista", unit: "hr", quantity: 1, performance: 1.2, unitPrice: 8500, total: 10200 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },

  // 6. SUMINISTROS ELÉCTRICOS Y CONTROL
  {
    name: "Canalización con tubo PVC Conduit 20mm",
    unit: "m",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m23", description: "Tubo Conduit 20mm", unit: "m", quantity: 1.05, unitPrice: 1200, total: 1260 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo18", description: "Electricista", unit: "hr", quantity: 1, performance: 0.2, unitPrice: 9500, total: 1900 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },
  {
    name: "Cámara de inspección eléctrica 40x40",
    unit: "un",
    items: {
      [ItemCategory.MATERIAL]: [{ id: "m24", description: "Cámara prefabricada 40x40", unit: "un", quantity: 1, unitPrice: 45000, total: 45000 }],
      [ItemCategory.MANO_DE_OBRA]: [{ id: "mo19", description: "Jornal instalación", unit: "hr", quantity: 1, performance: 3, unitPrice: 5200, total: 15600 }],
      [ItemCategory.EQUIPO]: [],
      [ItemCategory.OTROS]: []
    }
  },

  // ADICIONALES PARA LLEGAR A 30+
  { name: "Cama de arena para tubería", unit: "m3", items: { [ItemCategory.MATERIAL]: [{ id: "x1", description: "Arena de planta", unit: "m3", quantity: 1.2, unitPrice: 18500, total: 22200 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x2", description: "Jornal", unit: "hr", quantity: 1, performance: 0.8, unitPrice: 5200, total: 4160 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Válvula de aire trifuncional 2\"", unit: "un", items: { [ItemCategory.MATERIAL]: [{ id: "x3", description: "Válvula ventosa 2\"", unit: "un", quantity: 1, unitPrice: 380000, total: 380000 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x4", description: "Maestro", unit: "hr", quantity: 1, performance: 2, unitPrice: 9500, total: 19000 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Limpieza y desinfección de red", unit: "m", items: { [ItemCategory.MATERIAL]: [{ id: "x5", description: "Hipoclorito de sodio", unit: "lt", quantity: 0.1, unitPrice: 1200, total: 120 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x6", description: "Operador", unit: "hr", quantity: 1, performance: 0.1, unitPrice: 12000, total: 1200 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Prueba de presión hidráulica", unit: "gl", items: { [ItemCategory.MATERIAL]: [], [ItemCategory.MANO_DE_OBRA]: [{ id: "x7", description: "Cuadrilla técnica", unit: "hr", quantity: 1, performance: 8, unitPrice: 25000, total: 200000 }], [ItemCategory.EQUIPO]: [{ id: "x8", description: "Bomba de prueba", unit: "día", quantity: 1, unitPrice: 35000, total: 35000 }], [ItemCategory.OTROS]: [] } },
  { name: "Pintura epóxica muros estanques", unit: "m2", items: { [ItemCategory.MATERIAL]: [{ id: "x9", description: "Pintura epóxica grado alimenticio", unit: "gl", quantity: 0.25, unitPrice: 65000, total: 16250 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x10", description: "Pintor", unit: "hr", quantity: 1, performance: 0.8, unitPrice: 8500, total: 6800 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Suministro e instalación de caudalímetro", unit: "un", items: { [ItemCategory.MATERIAL]: [{ id: "x11", description: "Caudalímetro electromagnético", unit: "un", quantity: 1, unitPrice: 1450000, total: 1450000 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x12", description: "Instrumentista", unit: "hr", quantity: 1, performance: 12, unitPrice: 18500, total: 222000 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Geotextil de separación", unit: "m2", items: { [ItemCategory.MATERIAL]: [{ id: "x13", description: "Geotextil no tejido", unit: "m2", quantity: 1.15, unitPrice: 1850, total: 2128 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x14", description: "Jornal", unit: "hr", quantity: 1, performance: 0.1, unitPrice: 5200, total: 520 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Radier de hormigón H-20 e=10cm", unit: "m2", items: { [ItemCategory.MATERIAL]: [{ id: "x15", description: "Hormigón H-20", unit: "m3", quantity: 0.105, unitPrice: 95000, total: 9975 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x16", description: "Cuadrilla radier", unit: "hr", quantity: 1, performance: 0.8, unitPrice: 12500, total: 10000 }], [ItemCategory.EQUIPO]: [{ id: "x17", description: "Regla vibradora", unit: "día", quantity: 0.05, unitPrice: 25000, total: 1250 }], [ItemCategory.OTROS]: [] } },
  { name: "Cámara de válvulas HA prefabricada", unit: "un", items: { [ItemCategory.MATERIAL]: [{ id: "x18", description: "Cámara de hormigón armado", unit: "un", quantity: 1, unitPrice: 850000, total: 850000 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x19", description: "Montajista", unit: "hr", quantity: 1, performance: 8, unitPrice: 9500, total: 76000 }], [ItemCategory.EQUIPO]: [{ id: "x20", description: "Grúa 20 ton", unit: "hr", quantity: 2, unitPrice: 65000, total: 130000 }], [ItemCategory.OTROS]: [] } },
  { name: "Cubeta de acero inoxidable", unit: "un", items: { [ItemCategory.MATERIAL]: [{ id: "x21", description: "Cubeta AISI 304", unit: "un", quantity: 1, unitPrice: 125000, total: 125000 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x22", description: "Gasfíter", unit: "hr", quantity: 1, performance: 2, unitPrice: 8500, total: 17000 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Letrero de obra 2.40 x 1.20 m", unit: "un", items: { [ItemCategory.MATERIAL]: [{ id: "x23", description: "Letrero bastidor madera/grafica", unit: "un", quantity: 1, unitPrice: 185000, total: 185000 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x24", description: "Jornal", unit: "hr", quantity: 1, performance: 4, unitPrice: 5200, total: 20800 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } },
  { name: "Malla de advertencia subterránea", unit: "m", items: { [ItemCategory.MATERIAL]: [{ id: "x25", description: "Cinta de advertencia PELIGRO", unit: "m", quantity: 1.05, unitPrice: 150, total: 158 }], [ItemCategory.MANO_DE_OBRA]: [{ id: "x26", description: "Jornal", unit: "hr", quantity: 1, performance: 0.05, unitPrice: 5200, total: 260 }], [ItemCategory.EQUIPO]: [], [ItemCategory.OTROS]: [] } }
];

