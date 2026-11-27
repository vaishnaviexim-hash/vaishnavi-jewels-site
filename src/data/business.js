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
  // Owner 26 Nov 2026 16:19-16:23 (Brain C-20261126-OWNERNUMBER): calls AND WhatsApp go to the owner's
  // number 75674 00099 everywhere; Aashvi's 99980 43886 is shown only as a second number (may be removed later).
  phone: '+91 75674 00099',
  phoneE164: '+917567400099',
  whatsappDisplay: '+91 75674 00099',
  whatsappE164: '+917567400099',
  whatsapp: 'https://wa.me/917567400099?text=Hi%20Vaishnavi%20Jewels%2C%20I%20found%20you%20on%20your%20website.',
  altPhone: '+91 99980 43886',
  altPhoneE164: '+919998043886',
  email: 'surat@vaishnavijewels.com',
  // Normal hours: Monday to Saturday 11 AM-8 PM, closed Sunday. Every year the
  // showroom is also open on Sundays in the festive month before Diwali (R-065).
  // 2026: open every day until 7 Nov (F-020), closed 8-15 Nov, reopens Mon 16 Nov (F-017).
  hoursText: 'Monday to Saturday, 11 AM to 8 PM.',
  hoursShort: 'Mon to Sat, 11 AM to 8 PM',
  payment: 'NEFT, UPI and cash (no EMI)',
  showroomSize: '2,500 sq ft',
  designs: '3,000+',
  // Starting price of our diamond jewellery, owner 28 Oct 2026.
  priceFrom: '₹25,000',
  sameAs: [
    'https://instagram.com/vaishnavijewels.surat',
    'https://pinterest.com/vaishnavijewels01',
    'https://x.com/vaishnavi_jewel',
    'https://youtube.com/@VaishnaviJewelsSurat',
    'https://www.linkedin.com/company/86855728/',
    'https://www.facebook.com/122368924568460',
    'https://maps.google.com/maps?cid=13565734126936155375',
    'https://share.google/P1oHICy1oT9OOlPHS',
    // C-20261124-SEONAME: our own directory profiles (third-party proof)
    'https://www.justdial.com/Surat/Vaishnavi-Jewels-Near-Jaani-Farshan-Parle-Point/0261PX261-X261-101231105547-V6H9_BZDET',
    'https://www.wedmegood.com/profile/Vaishnavi-Jewels-26774430',
    'https://www.weddingwire.in/bridal-jewellery/vaishnavi-jewels--e497557',
    'https://www.trustpilot.com/review/vaishnavijewels.com',
    'https://m.indiamart.com/vaishnavi-jewels/',
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
  { path: '/new-designs', label: 'New Designs' },
  { path: '/visit-us', label: 'Visit Our Showroom' },
  { path: '/book-a-visit', label: 'Book a Showroom Visit' },
  { path: '/diamond-search', label: 'Diamond Search' },
  { path: '/diamond-requirement', label: 'Find a Diamond' },
  { path: '/delivery-across-india', label: 'Delivery Across India' },
  { path: '/faq', label: 'FAQ' },
  { path: '/facts', label: 'Facts' },
  { path: '/press', label: 'Press' },
  { path: '/jadau-jewellery', label: 'Jadau Jewellery' },
  { path: '/careers', label: 'Careers' },
];

export function storeSchema(imageUrl) {
  const b = business;
  return {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    '@id': SITE_URL + '/#store',
    name: b.name,
    legalName: b.legalName,
    alternateName: [b.legalName, 'Vaishnavi Jewels Surat', 'Vaishnavi Jewellers', 'Vaishnavi Jewellers Surat'], // C-20261124-SEONAME: people search 'Vaishnavi Jewellers'
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
    priceRange: 'From ₹25,000',
    areaServed: { '@type': 'Country', name: 'India' },
    paymentAccepted: 'NEFT, UPI, Cash',
    currenciesAccepted: 'INR',
    knowsAbout: ['Certified diamond jewellery', 'Certified solitaire rings', 'Natural diamond jewellery', 'Lab-grown diamond jewellery', 'Polki jewellery', 'Bridal jewellery', 'Mangalsutra', 'Custom jewellery design', 'BIS HUID hallmarking'],
    hasMap: b.mapsUrl,
    sameAs: b.sameAs,
  };
}
