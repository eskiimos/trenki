const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const inputSvg = path.join(__dirname, '../public/icons/icon-app.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  // Проверяем наличие sharp
  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    console.log('⚠️  Sharp не установлен, пропускаем генерацию иконок');
    console.log('   (Иконки уже существуют или будут созданы вручную)');
    return;
  }

  // Проверяем наличие исходного SVG
  if (!fs.existsSync(inputSvg)) {
    console.log('⚠️  Исходный SVG не найден, пропускаем генерацию иконок');
    return;
  }

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

generateIcons().catch(error => {
  console.error('Ошибка при генерации иконок:', error.message);
  // Не прерываем сборку - иконки не критичны
});
