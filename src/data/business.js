// Single source of truth for business facts used across the site and schema.
// Change a fact here and every page + the structured data update together.
export const SITE_URL = 'https://vaishnavijewels.com';

export const business = {
  legalName: 'Vaishnavi Gem & Jewel Pvt Ltd',
  name: 'Vaishnavi Jewels',
  founder: 'Shilpi Agarwal',
  foundingDate: '2005-06-01',
  foundedText: '1 June 2005',
  street: 'UG120, Rajhans Ornate - High Street Retail Mall, Parle Point',
  city: 'Surat',
  region: 'Gujarat',
  postalCode: '395007',
  country: 'IN',
  addressText: 'UG120, Rajhans Ornate - High Street Retail Mall, Parle Point, Surat, Gujarat 395007',
  phone: '+91 75674 00099',
  phoneE164: '+917567400099',
  whatsapp: 'https://wa.me/917567400099?text=Hi%20Vaishnavi%20Jewels%2C%20I%20found%20you%20on%20your%20website.',
  email: 'vaishnaviexim@gmail.com',
  // Normal hours: Monday to Saturday 11 AM-8 PM, closed Sunday. Every year the
  // showroom is also open on Sundays in the festive month before Diwali (R-065).
  // 2026: open every day until 7 Nov (F-020), closed 8-15 Nov, reopens Mon 16 Nov (F-017).
  hoursText: 'Monday to Saturday, 11 AM to 8 PM. Open Sundays in the festive month before Diwali: open every day, Sundays included, 11 AM to 8 PM until 7 November 2026. Closed 8 to 15 November 2026 for Diwali; open again, with appointments, from Monday 16 November.',
  hoursShort: 'Mon to Sat 11 AM to 8 PM; open Sundays in the festive month before Diwali (every day until 7 Nov 2026); closed 8 to 15 Nov 2026, open again from Mon 16 Nov.',
  payment: 'NEFT, UPI and cash (no EMI)',
  showroomSize: '2,500 sq ft',
  designs: '3,000+',
  sameAs: [
    'https://instagram.com/vaishnavijewels.surat',
    'https://pinterest.com/vaishnavijewels01',
    'https://x.com/vaishnavi_jewel',
    'https://youtube.com/@VaishnaviJewelsSurat',
    'https://www.linkedin.com/company/86855728/',
    'https://www.facebook.com/122368924568460',
    'https://maps.google.com/maps?cid=13565734126936155375',
    'https://share.google/P1oHICy1oT9OOlPHS',
  ],
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Rajhans+Ornate+Mall%2C+Parle+Point%2C+Surat%2C+Gujarat',
};

// Pages listed in the footer, sitemap and IndexNow.
export const infoPages = [
  { path: '/solitaire-rings', label: 'Certified Solitaire Rings' },
  { path: '/natural-diamond-jewellery', label: 'Natural Diamond Jewellery' },
  { path: '/lab-grown-diamond-jewellery', label: 'Lab-Grown Diamond Jewellery' },
  { path: '/polki-jewellery', label: 'Polki Jewellery' },
  { path: '/bridal-jewellery', label: 'Bridal Jewellery' },
  { path: '/diamond-mangalsutra', label: 'Diamond Mangalsutra' },
  { path: '/diamond-earrings', label: 'Diamond Earrings' },
  { path: '/visit-us', label: 'Visit Our Showroom' },
  { path: '/delivery-across-india', label: 'Delivery Across India' },
  { path: '/faq', label: 'FAQ' },
  { path: '/facts', label: 'Facts' },
  { path: '/jadau-jewellery', label: 'Jadau Jewellery' },
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
    description: 'Certified diamond jewellery made in Surat, the diamond city, since 2005: natural and lab-grown diamond jewellery, certified solitaire rings laser-inscribed with a report number you can verify online, Polki and bridal jewellery, BIS HUID hallmarked and made in our own manufacturing unit, with insured delivery across India.',
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
    }, {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday'],
      opens: '11:00',
      closes: '20:00',
      validFrom: '2026-10-01',
      validThrough: '2026-11-07',
    }],
    // Diwali closure 2026 (Brain F-017): opens = closes = 00:00 means closed all day.
    specialOpeningHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      opens: '00:00',
      closes: '00:00',
      validFrom: '2026-11-08',
      validThrough: '2026-11-15',
    }],
    areaServed: { '@type': 'Country', name: 'India' },
    paymentAccepted: 'NEFT, UPI, Cash',
    currenciesAccepted: 'INR',
    knowsAbout: ['Certified diamond jewellery', 'Certified solitaire rings', 'Natural diamond jewellery', 'Lab-grown diamond jewellery', 'Polki jewellery', 'Bridal jewellery', 'Mangalsutra', 'Custom jewellery design', 'BIS HUID hallmarking'],
    hasMap: b.mapsUrl,
    sameAs: b.sameAs,
  };
}
