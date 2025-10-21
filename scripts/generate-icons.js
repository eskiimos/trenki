const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const inputSvg = path.join(__dirname, '../public/icons/icon-app.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('Генерация PWA иконок...');
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    
    try {
      await sharp(inputSvg)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 68, g: 92, b: 255, alpha: 1 } // #445CFF
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Создана иконка: icon-${size}.png`);
    } catch (error) {
      console.error(`❌ Ошибка создания icon-${size}.png:`, error.message);
    }
  }
  
  console.log('\n🎉 Генерация иконок завершена!');
}

generateIcons();
