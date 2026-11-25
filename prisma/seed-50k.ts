import { PrismaClient, PropertyType, ListingType, PropertyStatus, FurnishingStatus, PossessionStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CITIES = [
  { city: 'Bengaluru', state: 'Karnataka', localities: ['Indiranagar', 'Koramangala', 'Whitefield', 'HSR Layout', 'Jayanagar', 'Hebbal', 'Electronic City', 'Bellandur'], postal: '5600' },
  { city: 'Mumbai', state: 'Maharashtra', localities: ['Andheri West', 'Bandra West', 'Powai', 'Worli', 'Juhu', 'Malad', 'Thane West', 'Navi Mumbai'], postal: '4000' },
  { city: 'Delhi', state: 'Delhi', localities: ['Vasant Kunj', 'Dwarka', 'Saket', 'Rohini', 'Hauz Khas', 'Greater Kailash', 'Janakpuri', 'Lajpat Nagar'], postal: '1100' },
  { city: 'Hyderabad', state: 'Telangana', localities: ['Hitec City', 'Gachibowli', 'Jubilee Hills', 'Banjara Hills', 'Kondapur', 'Madhapur', 'Kukatpally'], postal: '5000' },
  { city: 'Pune', state: 'Maharashtra', localities: ['Kothrud', 'Wakad', 'Hinjewadi', 'Viman Nagar', 'Baner', 'Kalyani Nagar', 'Hadapsar'], postal: '4110' },
  { city: 'Chennai', state: 'Tamil Nadu', localities: ['Adyar', 'Velachery', 'Anna Nagar', 'T Nagar', 'OMR', 'Besant Nagar', 'Mylapore'], postal: '6000' },
];

const PROPERTY_TYPES: PropertyType[] = [
  PropertyType.APARTMENT,
  PropertyType.HOUSE,
  PropertyType.VILLA,
  PropertyType.PLOT,
  PropertyType.COMMERCIAL,
  PropertyType.OFFICE,
];

const LISTING_TYPES: ListingType[] = [
  ListingType.SALE,
  ListingType.RENT,
  ListingType.LEASE,
];

const FURNISHING: FurnishingStatus[] = [
  FurnishingStatus.UNFURNISHED,
  FurnishingStatus.SEMI_FURNISHED,
  FurnishingStatus.FULLY_FURNISHED,
];

async function main() {
  console.info('🚀 High-Scale 50,000+ Property Synthetic Generator');
  console.info('⚠️  Ensure you are executing this in a staging/testing database.');

  // Check if seed agent exists or create one
  let agent = await prisma.user.findFirst({ where: { role: Role.AGENT } });
  if (!agent) {
    const passwordHash = await bcrypt.hash('Password@123', 10);
    agent = await prisma.user.create({
      data: {
        fullName: 'Bulk Seed Agent',
        email: 'bulk.agent@realestateplatform.com',
        phone: '+919999988888',
        passwordHash,
        role: Role.AGENT,
      },
    });
  }

  const TOTAL_RECORDS = 50000;
  const BATCH_SIZE = 1000;
  const batches = TOTAL_RECORDS / BATCH_SIZE;

  console.info(`📦 Generating ${TOTAL_RECORDS} properties in ${batches} chunks of ${BATCH_SIZE}...`);

  const startTime = Date.now();

  for (let b = 0; b < batches; b++) {
    const propertiesData = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const index = b * BATCH_SIZE + i + 1;
      const cityObj = CITIES[index % CITIES.length];
      const locality = cityObj.localities[index % cityObj.localities.length];
      const pType = PROPERTY_TYPES[index % PROPERTY_TYPES.length];
      const lType = LISTING_TYPES[index % LISTING_TYPES.length];
      const bedrooms = pType === PropertyType.PLOT || pType === PropertyType.OFFICE || pType === PropertyType.COMMERCIAL ? 0 : (index % 4) + 1;
      const bathrooms = bedrooms === 0 ? 1 : Math.max(1, bedrooms - (index % 2));
      const price = lType === ListingType.RENT ? (15000 + (index % 80) * 1000) : (3500000 + (index % 250) * 100000);
      const carpetArea = 500 + (index % 200) * 15;

      propertiesData.push({
        ownerId: agent.id,
        title: `${bedrooms > 0 ? `${bedrooms} BHK ` : ''}${pType} in ${locality}, ${cityObj.city} #${index}`,
        slug: `property-${index}-${locality.toLowerCase().replace(/\s+/g, '-')}-${cityObj.city.toLowerCase()}-${Date.now().toString(36)}`,
        description: `Premium quality ${pType.toLowerCase()} available for ${lType.toLowerCase()} situated in prime ${locality}, ${cityObj.city}. Features modern infrastructure and great connectivity.`,
        propertyType: pType,
        listingType: lType,
        price,
        negotiable: index % 3 === 0,
        bedrooms,
        bathrooms,
        balconies: bedrooms > 1 ? 1 : 0,
        carpetArea,
        areaUnit: 'sqft',
        furnishingStatus: FURNISHING[index % FURNISHING.length],
        possessionStatus: PossessionStatus.READY_TO_MOVE,
        city: cityObj.city,
        locality,
        state: cityObj.state,
        country: 'India',
        postalCode: `${cityObj.postal}${10 + (index % 80)}`,
        address: `${100 + (index % 500)}, Main Road, Sector ${1 + (index % 20)}, ${locality}`,
        status: PropertyStatus.APPROVED,
        publishedAt: new Date(Date.now() - (index % 365) * 86400000),
      });
    }

    await prisma.property.createMany({
      data: propertiesData,
      skipDuplicates: true,
    });

    if ((b + 1) % 10 === 0 || b === batches - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.info(`   ➡️ Inserted ${(b + 1) * BATCH_SIZE} / ${TOTAL_RECORDS} records (${elapsed}s)`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.info(`🎉 Successfully seeded ${TOTAL_RECORDS} properties in ${totalTime} seconds!`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to run bulk 50k seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

