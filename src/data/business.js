// Single source of truth for business facts used across the site and schema.
// Change a fact here and every page + the structured data update together.
export const SITE_URL = 'https://vaishnavijewels.com';

export const business = {
  legalName: 'Vaishnavi Gem & Jewel Pvt Ltd',
  name: 'Vaishnavi Jewels',
  founder: 'Shilpi Agarwal',
  foundingDate: '2005-06-01',
  foundedText: '1 June 2005',
  street: '120, Rajhans Ornate - High Street Retail Mall, Parle Point',
  city: 'Surat',
  region: 'Gujarat',
  postalCode: '395007',
  country: 'IN',
  addressText: '120, Rajhans Ornate - High Street Retail Mall, Parle Point, Surat, Gujarat 395007',
  phone: '+91 75674 00099',
  phoneE164: '+917567400099',
  whatsapp: 'https://wa.me/917567400099',
  email: 'vaishnaviexim@gmail.com',
  hoursText: 'Monday to Saturday, 11 AM to 8 PM. Closed on Sunday.',
  showroomSize: '2,500 sq ft',
  designs: '3,000+',
  sameAs: [
    'https://instagram.com/vaishnavijewels.surat',
    'https://pinterest.com/vaishnavijewels01',
    'https://x.com/vaishnavi_jewel',
    'https://youtube.com/@VaishnaviJewelsSurat',
    'https://www.linkedin.com/company/86855728/',
    'https://share.google/P1oHICy1oT9OOlPHS',
  ],
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Rajhans+Ornate+Mall%2C+Parle+Point%2C+Surat%2C+Gujarat',
};

// Pages listed in the footer, sitemap and IndexNow.
export const infoPages = [
  { path: '/natural-diamond-jewellery', label: 'Natural Diamond Jewellery' },
  { path: '/lab-grown-diamond-jewellery', label: 'Lab-Grown Diamond Jewellery' },
  { path: '/polki-jewellery', label: 'Polki Jewellery' },
  { path: '/jadau-jewellery', label: 'Jadau Jewellery' },
  { path: '/bridal-jewellery', label: 'Bridal Jewellery' },
  { path: '/visit-us', label: 'Visit Our Showroom' },
  { path: '/delivery-across-india', label: 'Delivery Across India' },
  { path: '/faq', label: 'FAQ' },
  { path: '/facts', label: 'Facts' },
];

export function storeSchema(imageUrl) {
  const b = business;
  return {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    '@id': SITE_URL + '/#store',
    name: b.name,
    legalName: b.legalName,
    alternateName: [b.legalName, 'Vaishnavi Jewels Surat'],
    url: SITE_URL,
    logo: SITE_URL + '/logo_vaishnavi_jewels.png',
    image: imageUrl || SITE_URL + '/logo_vaishnavi_jewels.png',
    description: 'Fine jewellery showroom in Surat since 2005 offering certified natural diamond jewellery, lab-grown diamond jewellery, Polki and Jadau, made in-house, with insured delivery across India.',
    telephone: b.phoneE164,
    email: b.email,
    foundingDate: b.foundingDate,
    founder: { '@type': 'Person', name: b.founder },
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.street,
      addressLocality: b.city,
      addressRegion: b.region,
      postalCode: b.postalCode,
      addressCountry: b.country,
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '11:00',
      closes: '20:00',
    }],
    areaServed: { '@type': 'Country', name: 'India' },
    paymentAccepted: 'NEFT, UPI',
    currenciesAccepted: 'INR',
    knowsAbout: ['Natural diamond jewellery', 'Lab-grown diamond jewellery', 'Polki jewellery', 'Jadau jewellery', 'Bridal jewellery', 'Custom jewellery design'],
    hasMap: b.mapsUrl,
    sameAs: b.sameAs,
  };
}
