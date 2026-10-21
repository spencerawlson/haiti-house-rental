export const DEPARTMENTS = [
  { id: 'ouest', communes: ['Pétion-Ville', 'Delmas', 'Kenscoff', 'Carrefour', 'Tabarre', 'Port-au-Prince'] },
  { id: 'nord', communes: ['Cap-Haïtien', 'Limbé', 'Milot'] },
  { id: 'sud-est', communes: ['Jacmel', 'Bainet'] },
  { id: 'artibonite', communes: ['Gonaïves', 'Saint-Marc'] },
  { id: 'nord-est', communes: ['Fort-Liberté', 'Ouanaminthe'] },
  { id: 'nord-ouest', communes: ['Port-de-Paix'] },
  { id: 'centre', communes: ['Hinche', 'Mirebalais'] },
  { id: 'sud', communes: ['Les Cayes', 'Aquin'] },
  { id: 'grand-anse', communes: ['Jérémie'] },
  { id: 'nippes', communes: ['Miragoâne'] },
];

// Department display names, per language. The ids above stay the same
// (URLs, filters, stored locations) — only what the user reads changes.
// In Creole the names are Creole: Ouest is Lwès (West), not the French
// 'ouest'. A commune (Pétion-Ville) is never shown where a department
// belongs, and vice versa.
export const DEPARTMENT_NAMES = {
  ouest: { ht: 'Lwès', fr: 'Ouest', en: 'West' },
  nord: { ht: 'Nò', fr: 'Nord', en: 'North' },
  'sud-est': { ht: 'Sidès', fr: 'Sud-Est', en: 'Southeast' },
  artibonite: { ht: 'Latibonit', fr: 'Artibonite', en: 'Artibonite' },
  'nord-est': { ht: 'Nòdès', fr: 'Nord-Est', en: 'Northeast' },
  'nord-ouest': { ht: 'Nòdwès', fr: 'Nord-Ouest', en: 'Northwest' },
  centre: { ht: 'Sant', fr: 'Centre', en: 'Center' },
  sud: { ht: 'Sid', fr: 'Sud', en: 'South' },
  'grand-anse': { ht: 'Grandans', fr: "Grand'Anse", en: "Grand'Anse" },
  nippes: { ht: 'Nip', fr: 'Nippes', en: 'Nippes' },
};

export function departmentName(id, locale) {
  const names = DEPARTMENT_NAMES[id];
  if (!names) return id;
  return names[locale] || names.ht;
}
