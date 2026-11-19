import { colorName } from './cards.mjs';

const lowerFirst = text => text[0].toLocaleLowerCase('fr') + text.slice(1);
const clean = text => text.replace(/\s+/g, ' ').trim();
const words = new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' });

const searchAliases = [
  [/^sac cabas\b/i, 'tote bags sacs cabas shopper bag'],
  [/^sac à dos\b/i, 'backpacks'],
  [/^sac banane\b/i, 'banane waist bag fanny pack'],
  [/^batterie externe\b/i, 'power banks batteries portables'],
  [/^clé USB\b/i, 'flash drive USB stick'],
  [/^gourde\b/i, 'bouteilles'],
  [/^gourde (?:isotherme|thermique)\b/i, 'bouteilles isothermes thermiques'],
  [/^(?:mug|gobelet) (?:isotherme|thermique)\b/i, 'tumbler tasse isotherme'],
  [/^stylo à bille\b/i, 'stylo bille ballpoint pen'],
  [/^bloc de notes adhésives\b/i, 'bloc memo sticky notes post it'],
  [/^écouteurs\b/i, 'earbuds earphones'],
  [/^casque audio\b/i, 'headphones'],
  [/^chargeur sans fil\b/i, 'chargeur induction wireless charger'],
  [/^porte-clés\b/i, 'keyring keychain'],
];

export const catalogTypeName = type => type.replace(/^sac cabas\b/i, 'Tote bag');

export function catalogSearchTerms(type) {
  return searchAliases.filter(([rule]) => rule.test(type)).map(([, aliases]) => aliases).join(' ');
}

// Each rule matches the catalog type, so a nearby keyword never implies a
// feature the source did not provide (for example Bluetooth or cotton).
const intents = [
  [/^gobelet (?:isotherme|thermique)/i, 'pour une pause au bureau ou un kit de bienvenue', 'Indiquez le coloris et le logo souhaités pour faire confirmer la zone de marquage.'],
  [/^gourde/i, 'pour un kit d’accueil, une équipe sportive ou un événement', 'Précisez la quantité par coloris pour comparer les options de marquage.'],
  [/^mug.*sublimation/i, 'pour une tasse aux couleurs d’une entreprise', 'Joignez votre visuel pour faire vérifier sa compatibilité avec la zone de sublimation.'],
  [/^(?:tasse|mug|gobelet|thermos|bouteille)/i, 'pour un coffret d’entreprise ou une pause au bureau', 'Indiquez la quantité et le rendu du logo souhaités dans votre demande.'],
  [/^bloc de notes adhésives/i, 'pour glisser des notes adhésives publicitaires dans un kit de bureau', 'Précisez si le logo doit figurer sur la couverture ou sur les feuilles.'],
  [/^coffret.*(?:carnet|écriture|stylo|agenda)/i, 'comme coffret cadeau d’entreprise ou kit de bienvenue', 'Indiquez les éléments du coffret que vous souhaitez personnaliser.'],
  [/^(?:coffret|ensemble)/i, 'comme cadeau client ou comme lot pour un événement', 'Le devis peut préciser les éléments du coffret et les surfaces de marquage possibles.'],
  [/^(?:carnet|bloc-notes|cahier|agenda)/i, 'pour une formation, une réunion ou un kit de bienvenue', 'Indiquez le logo et l’emplacement souhaité sur la couverture pour faire vérifier les possibilités de marquage.'],
  [/^(?:stylo|roller|porte-mines|crayon)/i, 'pour équiper un stand, compléter un carnet ou préparer des pochettes de formation', 'Précisez l’emplacement du logo pour faire vérifier la surface de marquage.'],
  [/^batterie externe/i, 'comme power bank publicitaire pour des équipes en déplacement', 'Précisez les appareils à équiper et la connectique attendue avant de valider le devis.'],
  [/^(?:chargeur|câble|station de charge|adaptateur|hub)/i, 'pour un kit de travail ou un cadeau high-tech d’entreprise', 'Indiquez les appareils à équiper pour faire vérifier la compatibilité.'],
  [/^enceinte/i, 'comme cadeau high-tech ou lot pour un événement', 'Précisez vos coloris et le marquage souhaités dans la demande de devis.'],
  [/^(?:écouteur|casque)/i, 'pour un kit de travail ou un cadeau d’équipe', 'Un devis permet de confirmer les connexions compatibles et la zone à personnaliser.'],
  [/^clé USB/i, 'pour remettre des documents, une brochure ou un dossier de présentation', 'Indiquez la capacité recherchée et le visuel à marquer.'],
  [/^(?:support.*(?:téléphone|smartphone)|tapis de souris)/i, 'pour un poste de travail ou un kit d’accueil', 'Indiquez la surface souhaitée pour le logo dans votre demande.'],
  [/^sac à dos/i, 'pour équiper une équipe ou composer un kit d’accueil', 'Si le sac doit accueillir un ordinateur, indiquez sa taille dans la demande de devis.'],
  [/^(?:sac cabas|tote bag)/i, 'comme tote bag publicitaire pour remettre des documents lors d’un salon', 'Précisez la taille des documents ou objets à transporter et l’emplacement du logo souhaité.'],
  [/^(?:sac isotherme|sac glacière|glacière)/i, 'pour un kit repas d’entreprise ou une activité en extérieur', 'Vérifiez le format souhaité pour vos contenants avant de demander le marquage.'],
  [/^sac à cordons?/i, 'pour préparer des lots à distribuer lors d’un événement', 'Indiquez ce que le sac doit contenir et le coloris à assortir à votre logo.'],
  [/^(?:sac|fourre-tout|porte-documents|housse|trousse|pochette)/i, 'pour transporter des accessoires ou préparer des lots pour un salon', 'Indiquez les dimensions nécessaires et l’emplacement de marquage souhaité.'],
  [/^porte-clés.*(?:décapsuleur|ouvre-bouteille)/i, 'comme porte-clés publicitaire avec une fonction ouvre-bouteille', 'Précisez la taille du logo et le coloris souhaité pour le devis.'],
  [/^porte-clés/i, 'comme objet publicitaire à distribuer lors d’un événement', 'Indiquez la forme ou le coloris souhaité pour faire confirmer la surface de marquage.'],
  [/^(?:trophée|plaque (?:de récompense|commémorative))/i, 'pour une cérémonie, un concours ou une remise de prix', 'Précisez le texte, le logo et la date de la cérémonie dans la demande.'],
  [/^parapluie/i, 'comme parapluie publicitaire pour les équipes ou les invités', 'Indiquez le coloris et le nombre de zones à marquer pour faire vérifier le rendu.'],
];

const familyUse = {
  hydratation: 'pour une pause au travail ou un kit d’accueil',
  'carnets-et-coffrets': 'pour composer un cadeau d’entreprise',
  ecriture: 'pour des lots de papeterie d’entreprise',
  'high-tech': 'pour un kit high-tech d’entreprise',
  sacs: 'pour un salon ou une opération promotionnelle',
  'porte-cles': 'comme petit objet publicitaire pour une campagne',
  trophees: 'pour une remise de prix ou une cérémonie',
  'maison-loisirs-accessoires': 'pour un cadeau d’entreprise ou une sélection destinée à un événement',
};

function productFacts(product) {
  const pieces = clean(product.specification || '').split(/\s*·\s*/);
  const type = product.type.toLocaleLowerCase('fr');
  const first = pieces[0]?.toLocaleLowerCase('fr') ?? '';
  const expandedType = first.startsWith(type + ' en ') ? pieces[0] : product.type;
  if (first === type || expandedType !== product.type) pieces.shift();
  return { expandedType, facts: [...new Set(pieces.filter(Boolean))] };
}

function searchableDetail(facts, type) {
  const candidate = facts.find(fact => /^(?:\d[\d ,.]*(?:ml|l|go|w|mah|feuilles|pages)\b|a[456]\b|(?:acier inoxydable|inox|aluminium|bambou|coton|verre|céramique|ardoise)$)/i.test(fact));
  if (!candidate || type.toLocaleLowerCase('fr').includes(candidate.toLocaleLowerCase('fr'))) return '';
  return /^\d|^a[456]$/i.test(candidate) ? candidate : 'en ' + lowerFirst(candidate);
}

function catalogHeading(label, facts, type) {
  const heading = label[0].toLocaleUpperCase('fr') + label.slice(1);
  if (label !== lowerFirst(type) || label.length > 38) return heading;

  const mechanism = facts.find(fact => /^(?:bouton-poussoir|mécanisme rotatif)$/i.test(fact));
  if (mechanism) return heading + ' à ' + lowerFirst(mechanism);

  const ink = /^stylo\b/i.test(type) && facts.find(fact => /^encre (?:bleue|noire)$/i.test(fact));
  if (ink) return heading + ' à ' + lowerFirst(ink);

  const dimensions = facts.find(fact => /^\d+(?:[,.]\d+)?(?:\s*[×x]\s*\d+(?:[,.]\d+)?){1,2}\s*cm$/i.test(fact));
  return dimensions ? heading + ' ' + dimensions.replace(/\s*[×x]\s*/gi, ' × ') : heading;
}

export function describeProduct(product) {
  const type = clean(product.type);
  const { expandedType, facts } = productFacts(product);
  const lowerType = lowerFirst(expandedType);
  const modifier = searchableDetail(facts, expandedType);
  const label = modifier && /^carnet avec stylo$/i.test(type) && /^a[456]$/i.test(modifier)
    ? 'carnet ' + modifier + ' avec stylo' : modifier ? lowerType + ' ' + modifier : lowerType;
  const feminine = /^(?:tasse|gourde|bouteille|batterie|enceinte|clé USB|plaque |souris|housse|trousse|pochette)\b/i;
  const masculine = /^(?:gobelet|mug|thermos|carnet|bloc-notes|coffret|cahier|agenda|stylo|roller|crayon|chargeur|câble|sac|porte-clés|porte-documents|tapis|trophée|parapluie)\b/i;
  const phrase = /avec stylo$/i.test(label) ? label + ' à personnaliser'
    : /^écouteurs\b/i.test(type) ? label + ' personnalisés'
    : feminine.test(type) ? label + ' personnalisée'
    : masculine.test(type) ? label + ' personnalisé' : label + ' avec logo';
  const intent = intents.find(([rule]) => rule.test(type));
  const use = intent?.[1] ?? familyUse[product.family];
  const advice = intent?.[2] ?? 'Précisez votre quantité, le coloris et le marquage souhaités dans la demande de devis.';
  const knownFacts = facts.filter(fact => !/à confirmer|à vérifier|^accessoire pour clés$|^transport et rangement$|^accessoire de bureau$|^câble pour appareils compatibles$/i.test(fact));
  const colors = product.colors.map(colorName);
  const colorPhrase = colors.length > 4 ? ' Comparez les ' + colors.length + ' coloris listés ci-dessous.'
    : colors.length ? ' Coloris au catalogue : ' + words.format(colors) + '.' : '';
  const metadataStart = product.name + ' : ' + phrase + ' au Maroc.';
  const metaDetail = knownFacts.find(fact => !label.toLocaleLowerCase('fr').includes(fact.toLocaleLowerCase('fr')));
  const metaSuffix = metaDetail && metaDetail.length <= 36 ? ' ' + metaDetail + '.'
    : colors.length ? ' ' + (colors.length === 1 ? 'Coloris ' + colors[0].toLocaleLowerCase('fr') : colors.length + ' coloris à comparer') + '.' : '';
  const meta = metadataStart + metaSuffix + (metadataStart.length + metaSuffix.length < 112 ? ' Demandez un devis dès 50 pièces.' : '');
  const showFacts = facts.filter(fact => !/^(?:transport et rangement|accessoire pour clés|accessoire de bureau|câble pour appareils compatibles)$/i.test(fact));
  return {
    label,
    catalogHeading: catalogTypeName(catalogHeading(label, facts, type)),
    title: product.name + ' · ' + phrase,
    keyword: phrase + ' Maroc',
    modelKeyword: product.name + ' ' + phrase + ' Maroc',
    meta,
    copy: [
      product.name + ' : ' + label + ' à personnaliser avec votre logo ' + use + '.',
      (colorPhrase ? colorPhrase.trim() + ' ' : '') + advice + ' Les demandes de devis au Maroc démarrent à 50 pièces.',
    ],
    facts: showFacts,
  };
}
