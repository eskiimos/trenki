import { prisma } from '@/lib/prisma';

async function checkUserData() {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: '228594178' },
      include: { profile: true }
    });

    console.log('📊 User data in database:');
    console.log(JSON.stringify(user, null, 2));
    
    if (user) {
      console.log('\n✅ User found:');
      console.log('  telegramId:', user.telegramId);
      console.log('  firstName:', user.firstName);
      console.log('  lastName:', user.lastName);
      console.log('  username:', user.username);
      console.log('  email:', user.email);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserData();
